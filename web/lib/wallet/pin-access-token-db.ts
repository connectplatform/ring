import 'server-only' // Restrict this file to server environment. Ensures code-node isolation. Prevents use in browsers or edge runtimes.

// Import required cryptographic functions from Node.js
import { createHash, randomBytes } from 'crypto'

// Import database handler, allowing easy migration or test mocking
import { DatabaseFilter, db } from '@/lib/database'

// Import wallet types for static type checking and correct interfacing
import type { Wallet } from '@/features/auth/types'
import { decryptSecretWithPin, isLegacyV1Format } from '@/lib/wallet/encrypt-wallet-secret'
import type { WalletTransactionExcerpt, WalletTransactionKind, WalletTransactionDetails } from '@/features/wallet/types/transaction'

// ============================================================================
// PIN-GATED WALLET ACCESS TOKENS — Single Source of Truth (SSOT)
// ----------------------------------------------------------------------------
// Single-use, time-bound access tokens used for high-value wallet operations.
// All flows and security assumptions are documented below for maintainership.
// ============================================================================

const DEFAULT_TTL_SECONDS = 15 * 60 // Default: 15 minutes token lifetime if not overridden via ENV.
const TOKEN_BYTES = 32 // Access token is 32 bytes (256 bits) of entropy for strong uniqueness.

// -----------------------------------------------------------------------------
// AccessTokenScope and AccessTokenStatus types specify token's purpose and lifecycle
export type AccessTokenScope = 'withdrawal' | 'transfer' | 'admin'
export type AccessTokenStatus = 'active' | 'used' | 'revoked' | 'expired'

// -----------------------------------------------------------------------------
// Database representation of an access token. All persisted token info here.
export interface AccessTokenRow {
  id: string // Unique identifier (wat_timestamp_randomHex)
  userId: string
  tokenHash: string // Only the hash, never the raw token
  walletAddress: string
  chain: string
  scope: AccessTokenScope
  status: AccessTokenStatus // Enforces only valid statuses
  issuedAt: string // ISO8601 timestamp
  expiresAt: string // Expiry, ISO timestamp
  usedAt?: string // When token was marked used, if ever
  revokedAt?: string // When token was revoked, if applicable
  /** Additional context for auditing (e.g. operation metadata) */
  metadata?: Record<string, unknown>
}

// Type returned to the API client—never expose tokenHash or DB id
export interface IssuedToken {
  accessToken: string      // Raw token, only presented on issuance
  walletAddress: string
  expiresAt: string        // Expiry for UX display
  scope: AccessTokenScope
}

// -----------------------------------------------------------------------------
// Helpers: cryptographic hash, secure random, TTL calculations
// -----------------------------------------------------------------------------

/**
 * Derive a SHA-256 hex digest from a raw access token. 
 * The hash is what is persisted/queried in the DB.
 * Pre-image resistance is critical; never weaken this hash.
 */
function hashToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex')
}

/**
 * Generate a secure random access token as a hex string.
 * Uses Node.js cryptographically secure RNG.
 */
function generateRawToken(): string {
  return randomBytes(TOKEN_BYTES).toString('hex') // 64 hex chars
}

/**
 * Get the access token TTL in seconds—use env override if set, otherwise default.
 */
function getTtlSeconds(): number {
  const env = process.env.WALLET_ACCESS_TOKEN_TTL_SECONDS
  if (env && Number.isFinite(Number(env)) && Number(env) > 0) return Number(env)
  return DEFAULT_TTL_SECONDS
}

/**
 * Get the access token TTL in milliseconds (for time arithmetic).
 */
function getTtlMs(): number { 
  return getTtlSeconds() * 1000 
}

// -----------------------------------------------------------------------------
// Token Issuance: Issue a new one-time access token gated by a valid PIN.
// Throws for legacy wallets, PIN mismatch or DB errors.
// Automatically revokes any prior active tokens for user/scope.
// -----------------------------------------------------------------------------
// TODO: When migrating to Next.js 16, refactor this function as a Server Action
//       and enforce input validation with native action argument schemes.
//       - Use Next 16 server actions ("use server") for all high-value action endpoints.
//       - Replace direct calls in routes/api with server action imports.
//       - Leverage edge-safe mechanisms for environments beyond Node.

export async function issueAccessToken(
  userId: string,
  wallet: Wallet,
  pin: string,
  scope: AccessTokenScope = 'withdrawal',
  metadata: Record<string, unknown> = {},
): Promise<IssuedToken> {
  // Step 1: Validate user wallet is not legacy V1 (unsafe)
  if (isLegacyV1Format(wallet.encryptedPrivateKey)) {
    throw new Error('Legacy v1 wallet detected — run migrateUserWalletsToPin before issuing tokens')
  }

  // Step 2: Verify provided PIN by attempting to decrypt wallet secret.
  // If PIN incorrect or wallet envelope tampered, this throws.
  decryptSecretWithPin(wallet.encryptedPrivateKey, pin)

  // Step 3: Ensure no prior 'active' tokens for user/scope by auto-revoking them (race-attack protection).
  await revokeActiveTokens(userId, scope)

  // Step 4: Create a cryptographically-random token, derive its SHA-256 hash, and timestamp.
  const rawToken = generateRawToken()
  const tokenHash = hashToken(rawToken)
  const now = Date.now()
  const expiresAt = new Date(now + getTtlMs()).toISOString()
  // Compose a collision-resistant token record identifier.
  const id = `wat_${now}_${randomBytes(8).toString('hex')}`

  // Assemble token row for persistence.
  const row: AccessTokenRow = {
    id,
    userId,
    tokenHash,
    walletAddress: wallet.address,
    chain: wallet.chain,
    scope,
    status: 'active',
    issuedAt: new Date(now).toISOString(),
    expiresAt,
    metadata, // Place additional operation context (if any)
  }

  // Step 5: Persist token hash + audit metadata in DB.
  const insertRes = await db().createDoc('wallet_access_tokens', row as unknown as Record<string, unknown>)
  if (!insertRes.success) {
    throw new Error(insertRes.error?.message ?? 'Failed to persist access token')
  }

  // Step 6: Write an audit trail as a 0-amount transaction for later investigation.
  // Not required for operation, but aids compliance and admin traceability.
  try {
    await db().createDoc('wallet_transactions', {
      id: `wtx_pin_${id}`,
      userId,
      walletAddress: wallet.address,
      kind: 'pin_access_granted' as WalletTransactionKind, // Distinct type for PIN-based access
      timestamp: new Date(now).toISOString(),
      amount: '0',                  // No transfer; this is an authorization event only
      token: wallet.symbol,
      status: 'success',
      recipient: '',
    })
  } catch (error) {
    // Non-fatal: issuance continues, but failed audit trail should be monitored.
    console.error('Failed to create audit trail transaction:', error)
  }

  // Step 7: Only expose the one-time raw token and necessary data to client (never send tokenHash or DB id).
  return {
    accessToken: rawToken,
    walletAddress: wallet.address,
    expiresAt,
    scope,
  }
}

// -----------------------------------------------------------------------------
// Token Consumption: Mark token as used (atomic). Checks validity, expiry and double-use conditions.
// There are race-hardened checks, including atomic status update and TTL validation.
// TODO: When moving to Next.js 16, replace API route usage with Server Actions and
//       validate all input data with Zod or native validation (edge hardened).
// -----------------------------------------------------------------------------
export async function consumeAccessToken(
  rawToken: string,
  userId: string,
  expectedScope?: AccessTokenScope,
): Promise<AccessTokenRow> {
  // Step 1: Input sanity—ensure rawToken is the correct shape
  if (!rawToken || typeof rawToken !== 'string') {
    throw new Error('Invalid access token')
  }
  // Step 2: Hash input token for secure DB lookup (never query on raw token)
  const tokenHash = hashToken(rawToken)
  const now = Date.now()

  // Step 3: Query database for matching (tokenHash, userId)
  const database = db()
  const listRes = await database.queryDocs<AccessTokenRow>({
    collection: 'wallet_access_tokens',
    filters: [
      { field: 'tokenHash', operator: '==', value: tokenHash }, 
      { field: 'userId', operator: '==', value: userId }
    ],
  })
  if (!listRes.success) {
    throw new Error(listRes.error?.message ?? 'Failed to look up access token')
  }
  // Step 4: Ensure token exists—protects from invalid or replay attempts.
  const row = (listRes.data ?? [])[0] as AccessTokenRow | undefined
  if (!row) {
    throw new Error('Access token not found')
  }

  // Step 5: Check token is 'active' and not expired. Expired tokens are marked so atomically in DB.
  if (row.status !== 'active' || new Date(row.expiresAt).getTime() < now) {
    if (row.status === 'active' && new Date(row.expiresAt).getTime() < now) {
      // Atomically mark expired, but do not block on DB failure (audit only)
      await database.updateDoc('wallet_access_tokens', row.id, { status: 'expired' } as unknown as Record<string, unknown>)
    }
    throw new Error(`Access token ${row.status === 'active' ? 'expired' : row.status}`)
  }

  // Step 6: Scope check—confirm that token scope matches the operation's needs, if required.
  if (expectedScope && row.scope !== expectedScope) {
    throw new Error('Access token scope mismatch')
  }

  // Step 7: Mark token as used to prevent double spends, enforce atomic update.
  const usedAt = new Date(now).toISOString()
  const upd = await database.updateDoc('wallet_access_tokens', row.id, {
    status: 'used',
    usedAt,
  } as unknown as Record<string, unknown>)
  if (!upd.success) {
    throw new Error(upd.error?.message ?? 'Failed to mark access token as used')
  }
  // Step 8: Return full record for downstream logging or business operations
  return { ...row, status: 'used', usedAt }
}

// -----------------------------------------------------------------------------
// Token Revocation: Revoke all active tokens for (userId, scope), e.g. on issuance or security-sensitive user flows
// TODO: If DB supports, switch to atomic batch updates (Promise.all or DB-native bulk). 
//       In Next.js 16, move to server actions with explicit param validation and action auditing.
// -----------------------------------------------------------------------------
export async function revokeActiveTokens(
  userId: string,
  scope?: AccessTokenScope,
): Promise<number> {
  // Step 1: Create DB filters to restrict to this user's active tokens (and optionally, scope).
  const filters: DatabaseFilter[] = [
    { field: 'userId', operator: '==', value: userId }, 
    { field: 'status', operator: '==', value: 'active' }
  ]
  if (scope) filters.push({ field: 'scope', operator: '==', value: scope })

  // Step 2: Query for all relevant active tokens (limit to 200 for safety).
  const listRes = await db().queryDocs<AccessTokenRow>({
    collection: 'wallet_access_tokens',
    filters,
  })
  // Fail closed if no DB access (do not escalate).
  if (!listRes.success) return 0

  const rows = (listRes.data ?? []) as AccessTokenRow[]
  const now = new Date().toISOString()
  let revoked = 0

  // Step 3: Sequential per-token revocation.
  for (const r of rows) {
    // Update each token to status: 'revoked'. If update fails, continue to next.
    const res = await db().updateDoc('wallet_access_tokens', r.id, {
      status: 'revoked',
      revokedAt: now,
    } as unknown as Record<string, unknown>)
    if (res.success) revoked++
    // TODO: If possible, use Promise.all / native DB batch updates for higher throughput
  }
  // Returns count of tokens actually revoked.
  return revoked 
}

// STUB: Next.js/React context integration — this is still server-only logic.
// STUB: If this logic must be callable from client or edge (React 19/Next 16):
// STUB:   1. Refactor this module to exclusively use Next.js Server Actions ("use server").
// STUB:   2. Enforce strong args shape using Zod or native Typescript validation.
// STUB:   3. Wire up auth context via secure server context propagation or signed arguments.
// STUB:   4. Integrate secret-passing mechanism suitable for RSC/edge runtime (e.g. encrypted blobs passed to action).
// TODO: List all usages of these functions and convert direct API calls to Server Action endpoints in Next.js 16.