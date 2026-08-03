import { randomUUID } from 'node:crypto'
import { db } from '@/lib/database'
import { parseUserRolesArray, UserRolesArray, resolvePersistedUserRole } from '@/features/auth/user-role'
import { DEFAULT_LOCALE } from '@/lib/locale-config'
import { getDefaultTheme } from '@/lib/ring-config-core' // TODO: Consider using React 19 server context for dynamic theming if Next.js 16 and React 19 are adopted; see comments in createOAuthUserFromGooglePayload for further detail.

/**
 * UserRow represents a user record from the database, where extra unknown keys may exist.
 * All main fields are typed, with possible nullability for optional profile properties.
 */
export type UserRow = Record<string, unknown> & {
  id: string
  email?: string
  emailVerified?: Date | null
  name?: string | null
  image?: string | null
  role?: string
  username?: string | null
  createdAt?: Date | string
}

// Assigns numeric priorities to user roles for duplicate resolution; higher = more senior.
// Used in deduplication sorting.
const ROLE_PRIORITY: Record<string, number> = {
  [UserRolesArray.superadmin]: 6,
  [UserRolesArray.admin]: 5,
  [UserRolesArray.confidential]: 4,
  [UserRolesArray.member]: 3,
  [UserRolesArray.subscriber]: 2,
  [UserRolesArray.visitor]: 1,
}

/**
 * Normalizes email input for DB interactions: trims whitespace and converts to lower-case.
 * Ensures all comparisons/queries use the same format.
 */
export function normalizeAuthEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

/**
 * Detects if an error indicates a database unique constraint violation.
 * Recognizes both the Postgres code 23505 and generic error messages.
 */
export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: string }).code
  if (code === '23505') return true // 23505 = unique_violation in Postgres
  const message = String((error as Error).message ?? '')
  return message.includes('23505') || message.toLowerCase().includes('unique')
}

/**
 * Fetches all users with a case-insensitive match to the given email.
 * - Returns empty array if the input email is not valid after normalization.
 * - Results are ordered by oldest created first (for deduplication preference).
 */
export async function findUsersByEmail(email: string): Promise<UserRow[]> {
  const normalized = normalizeAuthEmail(email)
  if (!normalized) return []
  // Query by case-insensitive equality for email.
  const result = await db().queryDocs<UserRow>({
    collection: 'users',
    filters: [{ field: 'email', operator: 'ilike', value: normalized }],
    orderBy: [{ field: 'created_at', direction: 'asc' }],
    pagination: { limit: 50 },
  })
  if (!result.success) return []
  return result.data
}

/**
 * Looks up a user by email and applies deduplication logic.
 * - Returns a single UserRow or null if not found.
 * - Uses pickCanonicalUserFromDuplicates if duplicates exist.
 */
export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const users = await findUsersByEmail(email)
  if (users.length === 0) return null
  if (users.length === 1) return users[0]
  // Duplicates found, attempt deduplication logic to pick best user
  return pickCanonicalUserFromDuplicates(users)
}

/**
 * Utility: Maps a user role to a numeric "seniority" score.
 * - Used for deduplication sorting (higher priority wins).
 * - Returns 0 if role is undefined or not recognized.
 */
function roleScore(role: string | undefined): number {
  if (!role) return 0
  return ROLE_PRIORITY[role.toLowerCase()] ?? 0
}

/**
 * Deduplicate user records to find the canonical (most correct) user.
 * Sorts with this hierarchy:
 *  1. Is Google account linked
 *  2. Highest privilege role
 *  3. Username is exactly 'ceo'
 *  4. Earliest account creation date
 * If linkedUserIds is not provided, queries current Google-linked userIds.
 * Throws if list is empty: must have at least one candidate.
 *
 * TODO: In Next.js 16/React 19, transition to native server actions and transactional user deduplication/selection.
 * TODO: If available, leverage React 19/Next 16 context or memoization for cross-request caching of account-linked IDs.
 */
export async function pickCanonicalUserFromDuplicates(
  rows: UserRow[],
  linkedUserIds?: Set<string>
): Promise<UserRow> {
  if (rows.length === 0) {
    throw new Error('pickCanonicalUserFromDuplicates requires at least one row')
  }

  // If no externally provided set of account-linked user IDs, fetch all Google-linked accounts.
  // TODO: Memoize this query per-request with React 19 context or Next 16 server cache when possible for performance.
  let accountLinkedIds = linkedUserIds
  if (!accountLinkedIds) {
    accountLinkedIds = new Set<string>()
    // Query for all google-linked accounts, up to 500 max.
    const accountResult = await db().queryDocs<Record<string, unknown> & { id: string }>({
      collection: 'accounts',
      filters: [{ field: 'provider', operator: '==', value: 'google' }],
      pagination: { limit: 500 },
    })
    // Track userIds with Google-linked accounts.
    if (accountResult.success) {
      for (const account of accountResult.data) {
        const userId = account.userId as string | undefined
        if (userId) accountLinkedIds.add(userId)
      }
    }
    // TODO: Memoize with Next.js 16 server context or cache during a server action invocation.
  }

  // Sort users based on deduplication logic; see commentary above.
  const sorted = [...rows].sort((a, b) => {
    // Prefer Google-linked
    const aLinked = accountLinkedIds!.has(a.id) ? 1 : 0
    const bLinked = accountLinkedIds!.has(b.id) ? 1 : 0
    if (aLinked !== bLinked) return bLinked - aLinked

    // Then by user role seniority
    const aRole = roleScore(a.role)
    const bRole = roleScore(b.role)
    if (aRole !== bRole) return bRole - aRole

    // Prefer username 'ceo'
    const aCeo = a.username === 'ceo' ? 1 : 0
    const bCeo = b.username === 'ceo' ? 1 : 0
    if (aCeo !== bCeo) return bCeo - aCeo

    // Finally, prefer earliest createdAt timestamp
    const aCreated = a.createdAt ? new Date(a.createdAt as string).getTime() : 0
    const bCreated = b.createdAt ? new Date(b.createdAt as string).getTime() : 0
    return aCreated - bCreated
  })

  // Best user is first in sorted list.
  return sorted[0]
}

/**
 * Input type for resolving canonical user – can be either an explicit user ID or email.
 * Used by resolveCanonicalUser.
 */
export type ResolveCanonicalUserInput = {
  id?: string | null
  email?: string | null
}

/**
 * Result type for resolveCanonicalUser: includes canonical userId, the UserRow found (if any), and whether it was created.
 */
export type ResolveCanonicalUserResult = {
  canonicalId: string
  userRow: UserRow | null
  created: boolean
}

/**
 * Main "resolve user" API.
 * Attempts in order:
 *   1. Lookup by provided id.
 *   2. Lookup by email (normalized). If multiple found, dedupes.
 *   3. If no match and id present, signals intent to create (returns created: false, row: null).
 *
 * TODO: When moving to Next.js 16/React 19, use native server actions for atomic lookup-or-create.
 * TODO: Add React's useOptimistic()/server action error boundaries for more robust concurrent mutation handling if supported.
 */
export async function resolveCanonicalUser(
  input: ResolveCanonicalUserInput
): Promise<ResolveCanonicalUserResult> {
  const normalizedEmail = normalizeAuthEmail(input.email)

  // 1. Try direct lookup by explicit ID.
  if (input.id) {
    const byId = await db().readDoc<UserRow>('users', input.id)
    if (byId.success && byId.data) {
      return { canonicalId: input.id, userRow: byId.data, created: false }
    }
  }

  // 2. If no result, try finding by normalized email.
  if (normalizedEmail) {
    const byEmail = await findUserByEmail(normalizedEmail)
    if (byEmail) {
      // If provided id differs from found/canonical id, warn (indicates ongoing de-duplication/migration).
      if (input.id && input.id !== byEmail.id) {
        // Warn for logging/troubleshooting during PK migration.
        console.warn('user_migration_id_mismatch', {
          sessionId: input.id,
          canonicalId: byEmail.id,
          email: normalizedEmail,
        })
      }
      return { canonicalId: byEmail.id, userRow: byEmail, created: false }
    }
  }

  // 3. No matching user found. If an id is given, return with created: false (let caller create new row).
  if (!input.id) {
    throw new Error('resolveCanonicalUser: no existing user and no id to create')
  }

  // Return with given PK/id and no user found – creation expected by caller.
  return { canonicalId: input.id, userRow: null, created: false }
}

/**
 * Ensures that a user has a Google account linked in the accounts table.
 * - If an account exists but is linked to the wrong user, updates it.
 * - If an account does not exist, creates it with provided information.
 *
 * TODO: When Next.js 16/React 19 are available, consider wrapping this in a server action for transactional safety/error handling with boundaries and retries.
 * TODO: When Promise.withResolvers becomes broadly available, consider advanced concurrent handling.
 */
export async function ensureGoogleAccountLinked(params: {
  userId: string
  providerAccountId: string
  idToken?: string
}): Promise<void> {
  const { userId, providerAccountId, idToken } = params

  // Query accounts for a matching Google provider + providerAccountId
  const existing = await db().queryDocs<Record<string, unknown> & { id: string }>({
    collection: 'accounts',
    filters: [
      { field: 'provider', operator: '==', value: 'google' },
      { field: 'providerAccountId', operator: '==', value: providerAccountId },
    ],
    pagination: { limit: 1 },
  })

  // If already linked (but might be wrong user), update if necessary.
  if (existing.success && existing.data.length > 0) {
    const account = existing.data[0]
    if (account.userId !== userId) {
      // Associate the account with the correct userId if needed.
      await db().updateDoc('accounts', account.id, { userId })
    }
    return
  }

  // Otherwise, create new Google OIDC account linkage.
  const accountData = {
    userId,
    type: 'oidc',
    provider: 'google',
    providerAccountId,
    id_token: idToken ?? null,
  }

  const result = await db().createDoc('accounts', accountData)
  if (!result.success) {
    // TODO: With Next.js 16/React 19, run inside a server action transaction and catch errors with boundary; retry/backoff as needed.
    console.error('ensureGoogleAccountLinked: failed to link account', result.error)
    throw result.error ?? new Error('Failed to link Google account')
  }
}

/**
 * Idempotent creation of a new user from Google OAuth2 payload.
 * - If user already exists (race/parallel), returns existing.
 * - If not, inserts with all defaults and returns new user.
 * - Uses normalizeAuthEmail for duplicate avoidance.
 *
 * TODO: When Next.js 16/React 19 land: refactor to use atomic server actions for true atomicity.
 * TODO: Migrate theme selection to use React 19 Context/server context if writing users during onboarding.
 */
export async function createOAuthUserFromGooglePayload(params: {
  userId: string
  email: string
  name?: string | null
  image?: string | null
  emailVerified?: Date | null
  role?: string
}): Promise<UserRow> {
  const now = new Date()
  const normalizedEmail = normalizeAuthEmail(params.email)

  // Compose user object with all default fields and Google OIDC details.
  const userData = {
    id: params.userId,
    globalUserId: params.userId,
    email: normalizedEmail,
    emailVerified: params.emailVerified ?? null,
    name: params.name ?? null,
    image: params.image ?? null,
    role: resolvePersistedUserRole(params.role),
    isVerified: !!params.emailVerified, // This is redundant, but provided for convenience.
    createdAt: now,
    lastLogin: now,
    updatedAt: now,
    bio: '',
    username: null,
    phoneNumber: null,
    organization: null,
    position: null,
    wallets: [],
    canPostConfidentialOpportunities: false,
    canViewConfidentialOpportunities: false,
    postedOpportunities: [],
    savedOpportunities: [],
    notificationPreferences: {
      email: true,
      inApp: true,
      sms: false,
    },
    settings: {
      language: DEFAULT_LOCALE,
      theme: getDefaultTheme(), // TODO: Replace with ThemeContext (React 19 server context) in onboarding flows as soon as available.
      notifications: false,
    },
  }

  // Attempt to create user in DB; on unique violation, retrieve and return the pre-existing user instead.
  const result = await db().createDoc('users', userData, { id: params.userId })
  if (!result.success) {
    if (isUniqueViolation(result.error)) {
      // Race condition: lookup and return user.
      const existing = await findUserByEmail(normalizedEmail)
      if (existing) return existing
    }
    throw result.error ?? new Error('Failed to create OAuth user')
  }

  // If creation was successful, or result.data is not returned, fall back to userData.
  return (result.data ?? userData) as UserRow
}

// Simple in-memory (per-process) inflight promise cache to dedupe concurrent email-based async work.
// Ensures only one inflight operation per normalized email executes per runtime process.
/*
 * TODO: If Next.js 16 or React 19 introduce native inflight deduplication primitives (e.g., concurrent server context, action bundling, or Promise.withResolvers), 
 * replace with that to properly handle distributed/multithreaded concurrency or edge runtimes.
 */
const inFlightByEmail = new Map<string, Promise<string>>()

/**
 * Dedupes concurrent async operations on a given normalized email.
 * - Returns the same inflight promise if a resolver is already in progress for the email, per execution context.
 * - Removes entry after resolution/rejection for GC and to avoid memory leaks.
 * - Used for things like email-based user creation, avoiding duplicate DB writes.
 */
export async function resolveInFlightByEmail(
  email: string | null | undefined,
  resolver: () => Promise<string>
): Promise<string> {
  const key = normalizeAuthEmail(email)
  if (!key) return resolver()

  // Return existing inflight promise if present.
  const existing = inFlightByEmail.get(key)
  if (existing) return existing

  // Register resolver promise, remove from map finally for GC.
  const promise = resolver().finally(() => {
    inFlightByEmail.delete(key)
  })
  inFlightByEmail.set(key, promise)
  return promise
}

/**
 * Find a Ring user by Telegram identity.
 * Prefer Auth.js `accounts` (provider=telegram), then `communication.telegramId`.
 */
export async function findUserByTelegramId(
  telegramId: string | number | null | undefined,
): Promise<UserRow | null> {
  const id = String(telegramId ?? '').trim()
  if (!id) return null

  const accountResult = await db().queryDocs<
    Record<string, unknown> & { id: string; userId?: string }
  >({
    collection: 'accounts',
    filters: [
      { field: 'provider', operator: '==', value: 'telegram' },
      { field: 'providerAccountId', operator: '==', value: id },
    ],
    pagination: { limit: 1 },
  })

  if (accountResult.success && accountResult.data.length > 0) {
    const userId = accountResult.data[0].userId as string | undefined
    if (userId) {
      const byId = await db().readDoc<UserRow>('users', userId)
      if (byId.success && byId.data) return byId.data
    }
  }

  // Indexed path: data->'communication'->>'telegramId' (schema idx_users_telegram_id)
  const byComm = await db().queryDocs<UserRow>({
    collection: 'users',
    filters: [
      {
        field: 'communication',
        operator: 'jsonb-contains',
        value: { telegramId: id },
      },
    ],
    pagination: { limit: 5 },
  })
  if (byComm.success && byComm.data.length > 0) {
    return byComm.data[0]
  }

  return null
}

/**
 * Ensure Auth.js accounts row for Telegram OIDC (provider + providerAccountId).
 */
export async function ensureTelegramAccountLinked(params: {
  userId: string
  providerAccountId: string
  idToken?: string | null
}): Promise<void> {
  const { userId, providerAccountId, idToken } = params
  const accountId = String(providerAccountId).trim()
  if (!accountId) {
    throw new Error('ensureTelegramAccountLinked: missing providerAccountId')
  }

  const existing = await db().queryDocs<Record<string, unknown> & { id: string }>({
    collection: 'accounts',
    filters: [
      { field: 'provider', operator: '==', value: 'telegram' },
      { field: 'providerAccountId', operator: '==', value: accountId },
    ],
    pagination: { limit: 1 },
  })

  if (existing.success && existing.data.length > 0) {
    const account = existing.data[0]
    if (account.userId !== userId) {
      await db().updateDoc('accounts', account.id, { userId })
    }
    return
  }

  const result = await db().createDoc('accounts', {
    userId,
    type: 'oidc',
    provider: 'telegram',
    providerAccountId: accountId,
    id_token: idToken ?? null,
  })
  if (!result.success) {
    console.error('ensureTelegramAccountLinked: failed to link account', result.error)
    throw result.error ?? new Error('Failed to link Telegram account')
  }
}

/**
 * Persist Telegram id/username onto users.data.communication (indexed telegramId).
 * Awards `addedTelegram` once when a verified UID is newly linked (auth-telegram flow).
 * Rejects if the UID is already linked to a different user (unless caller merges first).
 */
export async function syncUserTelegramCommunication(params: {
  userId: string
  telegramId: string
  telegramUsername?: string | null
}): Promise<{ linked: boolean; newlyLinked: boolean }> {
  const telegramId = String(params.telegramId).trim()
  if (!telegramId || !/^\d{3,}$/.test(telegramId)) {
    throw new Error('syncUserTelegramCommunication: invalid telegramId')
  }

  const owner = await findUserByTelegramId(telegramId)
  if (owner && owner.id !== params.userId) {
    throw new Error('syncUserTelegramCommunication: telegramId already linked to another account')
  }

  const userResult = await db().readDoc<UserRow & { communication?: Record<string, unknown>; role?: string; username?: string | null; isVerified?: boolean }>(
    'users',
    params.userId,
  )
  const current =
    userResult.success && userResult.data
      ? (userResult.data as {
          communication?: Record<string, unknown>
          role?: string
          username?: string | null
          isVerified?: boolean
        })
      : {}
  const prev = (current.communication || {}) as Record<string, unknown>
  const prevId = String(prev.telegramId || '').trim()
  const newlyLinked = !/^\d{3,}$/.test(prevId)

  const nextUsername =
    (params.telegramUsername && String(params.telegramUsername).trim().replace(/^@+/, '')) ||
    (typeof prev.telegramUsername === 'string' ? prev.telegramUsername : '') ||
    ''

  await db().updateDoc('users', params.userId, {
    communication: {
      ...prev,
      telegramId,
      telegramUsername: nextUsername,
      telegramLinkedAt: newlyLinked
        ? new Date().toISOString()
        : prev.telegramLinkedAt || new Date().toISOString(),
    },
  })

  if (newlyLinked) {
    try {
      const { enqueueRewardCreditAddEvent } = await import(
        '@/lib/wallet/reward-credit-service'
      )
      await enqueueRewardCreditAddEvent({
        userId: params.userId,
        trigger: 'addedTelegram',
        username:
          (typeof current.username === 'string' && current.username.trim()) ||
          null,
        isVerified: Boolean(current.isVerified),
        userRole: current.role || null,
      })
    } catch (rewardError) {
      console.warn(
        'syncUserTelegramCommunication: addedTelegram reward skipped:',
        rewardError,
      )
    }
  }

  return { linked: true, newlyLinked }
}

function userCreatedAtMs(
  row: { createdAt?: unknown; created_at?: unknown } | null | undefined,
): number | null {
  const raw = row?.createdAt ?? row?.created_at
  if (!raw) return null
  const t = raw instanceof Date ? raw.getTime() : new Date(String(raw)).getTime()
  return Number.isFinite(t) ? t : null
}

function communicationOf(
  row: { communication?: Record<string, unknown> } | null | undefined,
): Record<string, unknown> {
  return row?.communication && typeof row.communication === 'object'
    ? ({ ...row.communication } as Record<string, unknown>)
    : {}
}

/**
 * Follow communication.mergedIntoUserId chain to the surviving Ring account
 * after a younger Telegram-OIDC shell was absorbed during profile link.
 */
export async function resolveCanonicalUserAfterTelegramMerge(
  user: UserRow,
): Promise<UserRow> {
  let current = user
  const visited = new Set<string>()
  for (let i = 0; i < 5; i++) {
    if (!current?.id || visited.has(current.id)) break
    visited.add(current.id)
    const mergedInto = String(
      communicationOf(
        current as { communication?: Record<string, unknown> },
      ).mergedIntoUserId || '',
    ).trim()
    if (!mergedInto || mergedInto === current.id) break
    const next = await db().readDoc<UserRow>('users', mergedInto)
    if (!next.success || !next.data) break
    current = next.data
  }
  return current
}

/** True when user looks like an ephemeral Telegram-OIDC signup (no email, TG-only accounts). */
async function isTelegramOidcShellUser(userId: string): Promise<boolean> {
  const userResult = await db().readDoc<UserRow & { email?: string | null }>(
    'users',
    userId,
  )
  if (!userResult.success || !userResult.data) return false
  if (normalizeAuthEmail(userResult.data.email)) return false

  const accounts = await db().queryDocs<
    Record<string, unknown> & { provider?: string }
  >({
    collection: 'accounts',
    filters: [{ field: 'userId', operator: '==', value: userId }],
    pagination: { limit: 10 },
  })
  if (!accounts.success) return false
  const providers = accounts.data
    .map((a) => String(a.provider || '').trim())
    .filter(Boolean)
  if (providers.length === 0) return true
  return providers.every((p) => p === 'telegram')
}

/**
 * Link Telegram to `targetUserId` during profile "connect Telegram".
 * If the UID already belongs to another Ring user that was created **later**
 * (typical: ephemeral Telegram-OIDC-only signup), merge that younger shell into
 * the target: reassign accounts row, clear TG from younger, mark merge.
 * Denies merge when the existing owner is older/equal age, missing createdAt,
 * or is not a Telegram-OIDC shell (anti-hijack).
 */
export async function linkTelegramToExistingUser(params: {
  targetUserId: string
  telegramId: string
  telegramUsername?: string | null
  idToken?: string | null
}): Promise<{
  linked: boolean
  newlyLinked: boolean
  mergedFromUserId?: string
}> {
  const targetUserId = String(params.targetUserId || '').trim()
  const telegramId = String(params.telegramId || '').trim()
  if (!targetUserId) throw new Error('linkTelegramToExistingUser: targetUserId required')
  if (!telegramId || !/^\d{3,}$/.test(telegramId)) {
    throw new Error('linkTelegramToExistingUser: invalid telegramId')
  }

  const owner = await findUserByTelegramId(telegramId)
  let mergedFromUserId: string | undefined

  if (owner && owner.id !== targetUserId) {
    const targetResult = await db().readDoc<UserRow>('users', targetUserId)
    if (!targetResult.success || !targetResult.data) {
      throw new Error('linkTelegramToExistingUser: target user not found')
    }

    const ownerCreated = userCreatedAtMs(owner)
    const targetCreated = userCreatedAtMs(targetResult.data)

    // Missing timestamps → deny (safer than guessing age).
    if (ownerCreated == null || targetCreated == null) {
      throw new Error(
        'linkTelegramToExistingUser: telegramId already linked to another account',
      )
    }

    // Only absorb a *younger* Telegram-OIDC shell into the older linker account.
    if (!(ownerCreated > targetCreated)) {
      throw new Error(
        'linkTelegramToExistingUser: telegramId already linked to an older or equal-age account',
      )
    }

    if (!(await isTelegramOidcShellUser(owner.id))) {
      throw new Error(
        'linkTelegramToExistingUser: telegramId already linked to a non-shell account',
      )
    }

    // 1) Clear TG identity from the younger shell (frees unique index / findByTelegramId)
    await unlinkTelegramCommunication(owner.id)

    // 2) Reassign Auth.js accounts.provider=telegram → target
    await ensureTelegramAccountLinked({
      userId: targetUserId,
      providerAccountId: telegramId,
      idToken: params.idToken,
    })

    // 3) Mark younger shell as merged (communication JSON — no extra SQL columns)
    try {
      const afterUnlink = await db().readDoc<
        UserRow & { communication?: Record<string, unknown> }
      >('users', owner.id)
      const comm = communicationOf(
        afterUnlink.success ? afterUnlink.data : null,
      )
      await db().updateDoc('users', owner.id, {
        communication: {
          ...comm,
          mergedIntoUserId: targetUserId,
          mergedAt: new Date().toISOString(),
          mergeReason: 'telegram_link_into_older_account',
        },
      })
    } catch (mergeMarkErr) {
      console.warn(
        'linkTelegramToExistingUser: merge marker on younger user skipped:',
        mergeMarkErr,
      )
    }

    mergedFromUserId = owner.id
    console.info('[Telegram link] merged younger OIDC user into linker', {
      youngerUserId: owner.id,
      targetUserId,
      telegramId,
      ownerCreated,
      targetCreated,
    })
  }

  const sync = await syncUserTelegramCommunication({
    userId: targetUserId,
    telegramId,
    telegramUsername: params.telegramUsername,
  })

  await ensureTelegramAccountLinked({
    userId: targetUserId,
    providerAccountId: telegramId,
    idToken: params.idToken,
  })

  return {
    linked: sync.linked,
    newlyLinked: sync.newlyLinked,
    mergedFromUserId,
  }
}

/**
 * Clear verified Telegram UID / username from users.data.communication.
 * Invalidates admin-bot whitelist cache so Chat ID ACL updates immediately.
 */
export async function unlinkTelegramCommunication(
  userId: string,
): Promise<{ unlinked: boolean }> {
  if (!userId?.trim()) {
    throw new Error('unlinkTelegramCommunication: userId required')
  }

  const userResult = await db().readDoc<
    UserRow & { communication?: Record<string, unknown> }
  >('users', userId)
  if (!userResult.success || !userResult.data) {
    throw new Error('unlinkTelegramCommunication: user not found')
  }

  const prev = (userResult.data.communication || {}) as Record<string, unknown>
  const hadUid = /^\d{3,}$/.test(String(prev.telegramId || '').trim())
  if (!hadUid && !prev.telegramUsername) {
    return { unlinked: false }
  }

  const next = { ...prev }
  delete next.telegramId
  delete next.telegramUsername
  delete next.telegramLinkedAt

  await db().updateDoc('users', userId, {
    communication: next,
  })

  try {
    const { invalidateWhitelistCache } = await import(
      '@/lib/telegram/admin-bot/whitelist'
    )
    invalidateWhitelistCache()
  } catch {
    // Non-blocking — whitelist may be unused in this deployment
  }

  return { unlinked: true }
}

/**
 * Create a platform user from Telegram OIDC profile (email usually absent).
 * Empty email is allowed by idx_users_email_unique_lower (partial unique).
 */
export async function createOAuthUserFromTelegramPayload(params: {
  userId: string
  name?: string | null
  image?: string | null
  telegramId: string
  telegramUsername?: string | null
  phoneNumber?: string | null
  role?: string
}): Promise<UserRow> {
  const now = new Date()
  const telegramId = String(params.telegramId).trim()

  const userData = {
    id: params.userId,
    globalUserId: params.userId,
    email: '',
    emailVerified: null,
    name: params.name ?? null,
    image: params.image ?? null,
    role: resolvePersistedUserRole(params.role),
    isVerified: false,
    createdAt: now,
    lastLogin: now,
    updatedAt: now,
    bio: '',
    username: params.telegramUsername ?? null,
    phoneNumber: params.phoneNumber ?? null,
    organization: null,
    position: null,
    wallets: [],
    canPostConfidentialOpportunities: false,
    canViewConfidentialOpportunities: false,
    postedOpportunities: [],
    savedOpportunities: [],
    notificationPreferences: {
      email: true,
      inApp: true,
      sms: false,
    },
    settings: {
      language: DEFAULT_LOCALE,
      theme: getDefaultTheme(),
      notifications: false,
    },
    // Telegram UID is applied via syncUserTelegramCommunication (awards + index SSOT)
    communication: {},
  }

  const result = await db().createDoc('users', userData, { id: params.userId })
  if (!result.success) {
    if (isUniqueViolation(result.error)) {
      const existing = await findUserByTelegramId(telegramId)
      if (existing) return existing
    }
    throw result.error ?? new Error('Failed to create Telegram OAuth user')
  }

  await syncUserTelegramCommunication({
    userId: params.userId,
    telegramId,
    telegramUsername: params.telegramUsername,
  })

  const refreshed = await db().readDoc<UserRow>('users', params.userId)
  return (refreshed.success && refreshed.data
    ? refreshed.data
    : (result.data ?? userData)) as UserRow
}

/**
 * Resolve or create canonical user for Telegram OIDC sign-in.
 * Optional phone match: only when phone is verified and matches an existing user.
 */
export async function resolveOrCreateTelegramUser(params: {
  telegramId: string
  name?: string | null
  image?: string | null
  username?: string | null
  phoneNumber?: string | null
  phoneNumberVerified?: boolean
  idToken?: string | null
}): Promise<{ userId: string; userRow: UserRow; created: boolean }> {
  const telegramId = String(params.telegramId).trim()
  if (!telegramId) {
    throw new Error('resolveOrCreateTelegramUser: missing telegramId')
  }

  const existing = await findUserByTelegramId(telegramId)
  if (existing) {
    // Prefer the surviving Ring account after a younger OIDC shell was merged away.
    const canonical = await resolveCanonicalUserAfterTelegramMerge(existing)
    await ensureTelegramAccountLinked({
      userId: canonical.id,
      providerAccountId: telegramId,
      idToken: params.idToken,
    })
    await syncUserTelegramCommunication({
      userId: canonical.id,
      telegramId,
      telegramUsername: params.username,
    })
    if (canonical.id !== existing.id) {
      console.info('[Telegram OIDC] resolved merged shell → canonical user', {
        shellUserId: existing.id,
        canonicalUserId: canonical.id,
        telegramId,
      })
    }
    return { userId: canonical.id, userRow: canonical, created: false }
  }

  // Safe phone link: verified phone_number matches an existing Ring user phoneNumber
  if (params.phoneNumberVerified && params.phoneNumber) {
    const phone = String(params.phoneNumber).trim()
    if (phone) {
      const byPhone = await db().queryDocs<UserRow>({
        collection: 'users',
        filters: [{ field: 'phoneNumber', operator: '==', value: phone }],
        pagination: { limit: 2 },
      })
      if (byPhone.success && byPhone.data.length === 1) {
        const row = byPhone.data[0]
        await ensureTelegramAccountLinked({
          userId: row.id,
          providerAccountId: telegramId,
          idToken: params.idToken,
        })
        await syncUserTelegramCommunication({
          userId: row.id,
          telegramId,
          telegramUsername: params.username,
        })
        return { userId: row.id, userRow: row, created: false }
      }
    }
  }

  const userId = randomUUID()
  const created = await createOAuthUserFromTelegramPayload({
    userId,
    name: params.name,
    image: params.image,
    telegramId,
    telegramUsername: params.username,
    phoneNumber: params.phoneNumberVerified ? params.phoneNumber : null,
  })
  await ensureTelegramAccountLinked({
    userId,
    providerAccountId: telegramId,
    idToken: params.idToken,
  })
  return { userId, userRow: created, created: true }
}
