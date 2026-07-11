// ============================================================================
// UNIFIED ensureWallet — config-driven multi-chain orchestrator (Solana native)
// ----------------------------------------------------------------------------
// Flawless Victory: Phase 0 + Phase 1 + Phase 2 hotfixes (2026-07-03)
//
// SSOT:
//   - Chain identity: lib/ring-config-chain.ts (SupportedChains/EnabledChains/NativeChain)
//   - Wallet domain: features/wallet/types/wallet.ts (Wallet, EnsureWalletResult,
//                     ChainWalletAdapter, GeneratedChainWallet, UserOverride)
//
// Race fix:
//   - All wallets are provisioned into an in-memory map; ONE write at the end
//     via setUserWallets() — eliminates the JSONB read-modify-write race that
//     the previous Promise.all design produced (story 6 — max one wallet per
//     chain is now actually atomic).
//
// React 19 / Next 16: this is a server-only orchestrator; callers should use
// the ensureUserWallets server action in app/_actions/wallet.ts (uses
// useActionState + revalidatePath for cache invalidation).
// ============================================================================

import 'server-only'

import { cache } from 'react'
import { auth } from '@/auth'
import { resolvePersistedUserRole, UserRolesArray } from '@/features/auth/user-role'
import { getChainAdapter } from '@/features/wallet/chains/registry'
import {
  getSystemConfigSnapshot,
} from '@/lib/ring-config-core'
import { getNativeTokenSymbol } from '@/lib/ring-config-chain'
import {
  getNativeChain,
  getNativeChainConfig,
} from '@/lib/ring-config-chain'
import type { EnabledChains, NativeChain, SupportedChains } from '@/lib/ring-config-chain'
import { encryptWalletSecret } from '@/lib/wallet/encrypt-wallet-secret'
import {
  appendWalletIfMissing,
  getUserWallets,
  setUserWallets,
} from '@/lib/wallet/user-wallet-db'
import type {
  EnsureWalletResult,
  UserOverride,
  Wallet,
} from '@/features/wallet/types/wallet'
import { selectDefaultWallet } from './utils'

// Re-export SSOT result type for backward compat with `import { EnsureWalletResult } from '@/features/wallet/services/ensure-wallet'`
export type { EnsureWalletResult, UserOverride }

// ----------------------------------------------------------------------------
// Ensure WALLET_ENCRYPTION_KEY env var is present (server-only).
// Throws on miss. Centralised here so we have a single fail-fast point
// before any wallet provisioning work begins.
// ----------------------------------------------------------------------------
function requireEncryptionKey(): string {
  const encryptionKey = process.env.WALLET_ENCRYPTION_KEY
  if (!encryptionKey) {
    // Structured operator log (SSOT pattern: structured object, not a freeform string)
    console.error(JSON.stringify({
      level: 'error',
      tag: 'CRITICAL_CONFIG',
      env: 'WALLET_ENCRYPTION_KEY',
      message: 'Wallet encryption key missing from environment. Refusing to provision wallets.',
    }))
    throw new Error('Wallet encryption key is not set. Check server logs for setup instructions.')
  }
  return encryptionKey
}

// ----------------------------------------------------------------------------
// Sort enabled chains so the native chain is first (deterministic default).
// Uses a stable Set for O(1) dedupe. If native is not enabled, returns
// enabled as-is in original order.
// ----------------------------------------------------------------------------
function sortChainsNativeFirst(
  enabled: EnabledChains[],
  native: NativeChain,
): EnabledChains[] {
  const seen = new Set<EnabledChains>()
  const dedup: EnabledChains[] = []
  for (const c of enabled) {
    if (!seen.has(c)) { seen.add(c); dedup.push(c) }
  }
  return native !== undefined && dedup.includes(native)
    ? [native, ...dedup.filter((c) => c !== native)]
    : dedup
}

// ----------------------------------------------------------------------------
// Resolve the active native chain + enabled list using SSOT accessors.
// Never hardcodes a literal — clones can change native via ring-config.json.
// ----------------------------------------------------------------------------
function resolveChainPlan(): { nativeChain: NativeChain; chains: EnabledChains[] } {
  const config = getSystemConfigSnapshot()
  // 1. SSOT: prefer the runtime accessor (resolves mainnet-vs-devnet logic)
  const nativeChain = (config.chains?.native ?? getNativeChain()) as NativeChain
  // 2. SSOT: enabled list — config.chains.enabled is the canonical array
  const enabled = (config.chains?.enabled ?? []) as EnabledChains[]
  if (enabled.length === 0) {
    // Defensive fallback to template defaults (legacy EVM+SVM)
    const fallback = getNativeChainConfig().enabled ?? (['solana', 'evm'] as EnabledChains[])
    return { nativeChain, chains: fallback.filter((c): c is EnabledChains => typeof c === 'string') }
  }
  return { nativeChain, chains: enabled }
}

function resolveAutoProvisionChains(
  nativeChain: NativeChain,
  enabled: EnabledChains[],
): EnabledChains[] {
  // SSOT (ring-config.json chains.native): custodial auto-provision is native-only.
  // EVM wallets for Web3 users are linked at crypto-wallet sign-in, not generated here.
  return enabled.includes(nativeChain) ? [nativeChain] : []
}

// ----------------------------------------------------------------------------
// Provisions a chain-specific wallet for the userId.
// - Generates wallet via chain adapter
// - Encrypts secret with env-derived key (PIN wrapped at write-time if a PIN
//   is available in user meta; default path uses env-only key — see
//   lib/wallet/encrypt-wallet-secret.ts for the versioned format)
// - Sets isDefault for the native chain
// - Idempotent via appendWalletIfMissing (per-chain key in walletMap)
// ----------------------------------------------------------------------------
async function provisionChainWallet(
  userId: string,
  chain: NativeChain,
  encryptionKey: string,
  isDefault: boolean,
): Promise<Wallet> {
  // getChainAdapter is async (lazy-loads EVM/Base adapters); must await.
  const adapter = await getChainAdapter(chain)
  const generated = await adapter.generate()

  // symbol: prefer adapter's getTokenSymbol() if exposed, else native token
  // symbol for the native chain, else the chain name as last-resort fallback.
  // TODO: Make getTokenSymbol required on ChainWalletAdapter (see types/wallet.ts).
  const symbol: string = isDefault
    ? getNativeTokenSymbol()
    : (typeof adapter.getTokenSymbol === 'function' ? adapter.getTokenSymbol() : (chain as string))

  const wallet: Wallet = {
    symbol,
    chain: generated.chain as SupportedChains,
    address: generated.address,
    encryptedPrivateKey: encryptWalletSecret(generated.secret, encryptionKey),
    createdAt: new Date(),
    label: adapter.getChainLabel(),
    isDefault,
    balance: '0',
  }

  await appendWalletIfMissing(userId, wallet)
  return wallet
}

// ----------------------------------------------------------------------------
// Main orchestrator: Ensures user has a custodial native-chain wallet.
// - Native chain only (Solana); EVM is linked via crypto-wallet sign-in
// - Visitors blocked from wallet creation
// - userOverride path is for admin/system flows (e.g. /api/wallet/ensure)
// - Atomic single-write at the end eliminates JSONB race
// ----------------------------------------------------------------------------
export async function ensureWallets(
  userOverride?: UserOverride,
): Promise<EnsureWalletResult> {
  // Structured trace log
  console.log(JSON.stringify({
    level: 'info',
    tag: 'ensureWallets.start',
    mode: userOverride ? 'override' : 'session',
  }))

  // ----- 1. Resolve user identity (SSOT) ------------------------------------
  let userId: string
  let userRole: UserRolesArray

  if (userOverride) {
    userId = userOverride.id
    userRole = resolvePersistedUserRole(userOverride.role)
  } else {
    const session = await auth()
    if (!session?.user) {
      throw new Error('Unauthorized: Please log in to ensure wallet')
    }
    userId = session.user.id
    userRole = resolvePersistedUserRole(session.user.role)
  }

  if (userRole === UserRolesArray.visitor) {
    throw new Error('Access denied: Visitors cannot have wallets')
  }

  // ----- 2. Pre-flight: encryption key + chain plan ------------------------
  const encryptionKey = requireEncryptionKey()
  const { nativeChain, chains } = resolveChainPlan()
  const chainsToProvision = resolveAutoProvisionChains(nativeChain, chains)

  // ----- 3. Load existing wallets (React 19 cache) -------------------------
  const existing = await getUserWallets(userId)

  // Build keyed map by chain (string-typed to support legacy chainless rows
  // via DEFAULT_WALLET_CHAIN key — see features/wallet/types/wallet.ts)
  const walletMap = new Map<string, Wallet>()
  for (const w of existing) {
    if (w.chain) walletMap.set(w.chain, w)
  }

  // ----- 4. Provision missing chains IN MEMORY (no DB writes yet) -----------
  // SEQUENTIAL on purpose: avoids parallel JSONB read-modify-write races.
  // Each provisionChainWallet call is independent (different chains) and
  // the DB write is deferred to step 5.
  const toProvision: EnabledChains[] = []
  for (const chain of chainsToProvision) {
    if (!walletMap.has(chain)) toProvision.push(chain)
  }

  for (const chain of toProvision) {
    const isDefault = chain === nativeChain
    const created = await provisionChainWallet(
      userId,
      chain as NativeChain,
      encryptionKey,
      isDefault,
    )
    walletMap.set(created.chain, created)
  }

  // ----- 5. Normalise isDefault + ATOMIC single write -----------------------
  // Only the native chain may have isDefault=true (story: one default per user).
  // We compute the normalised set first, diff against the in-memory existing,
  // and persist via ONE setUserWallets call (eliminates the race).
  const merged: Wallet[] = Array.from(walletMap.values())
  const normalized: Wallet[] = merged.map((w) => ({
    ...w,
    isDefault: w.chain === nativeChain,
  }))

  const existingByChain = new Map<string, Wallet>()
  for (const w of existing) {
    if (w.chain) existingByChain.set(w.chain, w)
  }

  const changed =
    normalized.length !== existing.length ||
    normalized.some((w) => {
      if (!w.chain) return true
      const prev = existingByChain.get(w.chain)
      if (!prev) return true
      return w.isDefault !== prev.isDefault || w.address !== prev.address
    })

  if (changed) {
    if (process.env.NODE_ENV === 'development' || process.env.DB_DEBUG === 'true') {
      console.log(JSON.stringify({ level: 'info', tag: 'ensureWallets.write', userId, walletCount: normalized.length }))
    }
    await setUserWallets(userId, normalized)
  }

  // ----- 6. Native wallet resolution + post-provision hook -----------------
  // SSOT lookup: use the chain-aware selector, NOT a hardcoded string compare.
  const nativeWallet = selectDefaultWallet(normalized, nativeChain as SupportedChains)
  if (!nativeWallet) {
    // Defensive: should never happen if config + adapter registry are consistent
    throw new Error(`Failed to provision native ${String(nativeChain)} wallet`)
  }

  // Optional post-provision on-chain init (gasless airdrop, ATA create, etc.)
  // Hook is currently a no-op in onchain-init.ts; kept as try/catch for
  // forward-compat — failures here MUST NOT block wallet creation.
  try {
    const { initializeOnChain } = await import('@/features/wallet/services/onchain-init')
    if (typeof initializeOnChain === 'function') {
      await initializeOnChain(nativeWallet)
    }
  } catch (err) {
    // Structured warn — operator-relevant but not fatal
    console.warn(JSON.stringify({
      level: 'warn',
      tag: 'onchain-init.skipped',
      reason: err instanceof Error ? err.message : String(err),
    }))
  }

  console.log(JSON.stringify({
    level: 'info',
    tag: 'ensureWallets.ok',
    userId,
    nativeChain,
    walletCount: normalized.length,
  }))

  return { native: nativeWallet, wallets: normalized }
}

/**
 * Convenience single-wallet wrapper for legacy callers that expect a single
 * native wallet. New code should prefer ensureWallets() to receive the full set.
 */
export async function ensureWallet(userOverride?: UserOverride): Promise<Wallet> {
  const result = await ensureWallets(userOverride)
  return result.native
}

// ----------------------------------------------------------------------------
// Cached variant — React 19 cache() gives us request-scoped memoisation
// so multiple ensureWallets() calls in the same render don't repeat DB work.
// Backed by the same orchestrator (race-safe).
// ----------------------------------------------------------------------------
export const ensureWalletsCached = cache(
  async (userOverride?: UserOverride): Promise<EnsureWalletResult> => ensureWallets(userOverride),
)

// ----------------------------------------------------------------------------
// PIN-wrapped decryption path (Phase 1 surface, full impl in 1c).
// Signature stabilised here so the route layer in app/api/wallet/pin-access
// doesn't change shape during the migration.
// ----------------------------------------------------------------------------
export async function decryptPrivateKeyWithPin(
  encryptedPrivateKey: string,
  pin: string,
): Promise<string> {
  // Delegated to the lib/wallet/ PIN-aware helper (full impl in Phase 1c).
  // Import dynamically to keep this file cheap on the cold path.
  const { decryptSecretWithPin } = await import('@/lib/wallet/encrypt-wallet-secret')
  return decryptSecretWithPin(encryptedPrivateKey, pin)
}

// ----------------------------------------------------------------------------
// PIN-based access token issuer (Phase 3 surface, full impl in 3b).
// Returns { accessToken, walletAddress }. The Server Action in
// app/_actions/wallet.ts is the recommended entry point (useActionState).
// ----------------------------------------------------------------------------
export async function createPinAccessToken(
  userId: string,
  pin: string,
  role: UserRolesArray = UserRolesArray.subscriber,
): Promise<{ accessToken: string; walletAddress: string }> {
  const wallet = await ensureWallet({ id: userId, role: resolvePersistedUserRole(role) })

  // Delegated to lib/wallet/pin-access-token-db (Phase 3a). Validates PIN
  // by attempting decryption; throws on failure.
  const { issueAccessToken } = await import('@/lib/wallet/pin-access-token-db')
  return issueAccessToken(userId, wallet, pin)
}
