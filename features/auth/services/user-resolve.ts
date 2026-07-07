import { db } from '@/lib/database'
import { parseUserRolesArray, UserRolesArray } from '@/features/auth/user-role'
import { ALL_USER_ROLES_SET } from '@/features/auth/user-role'
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
    // If role not provided, fall back to visitor (lowest privilege) after validating.
    role: params.role ?? (ALL_USER_ROLES_SET.has(parseUserRolesArray(params.role) as UserRolesArray) ? params.role : UserRolesArray.visitor),
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
