import { db } from '@/lib/database'
import { UserRole } from '@/features/auth/user-role'
import { DEFAULT_USER_ROLE } from '@/features/auth/role-intent'

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

const ROLE_PRIORITY: Record<string, number> = {
  [UserRole.superadmin]: 6,
  [UserRole.admin]: 5,
  [UserRole.confidential]: 4,
  [UserRole.member]: 3,
  [UserRole.subscriber]: 2,
  [UserRole.visitor]: 1,
}

export function normalizeAuthEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: string }).code
  if (code === '23505') return true
  const message = String((error as Error).message ?? '')
  return message.includes('23505') || message.toLowerCase().includes('unique')
}

export async function findUsersByEmail(email: string): Promise<UserRow[]> {
  const normalized = normalizeAuthEmail(email)
  if (!normalized) return []

  const result = await db().queryDocs<UserRow>({
    collection: 'users',
    filters: [{ field: 'email', operator: 'ilike', value: normalized }],
    orderBy: [{ field: 'created_at', direction: 'asc' }],
    pagination: { limit: 50 },
  })

  if (!result.success) return []
  return result.data
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const users = await findUsersByEmail(email)
  if (users.length === 0) return null
  if (users.length === 1) return users[0]
  return pickCanonicalUserFromDuplicates(users)
}

function roleScore(role: string | undefined): number {
  if (!role) return 0
  return ROLE_PRIORITY[role.toLowerCase()] ?? 0
}

export async function pickCanonicalUserFromDuplicates(
  rows: UserRow[],
  linkedUserIds?: Set<string>
): Promise<UserRow> {
  if (rows.length === 0) {
    throw new Error('pickCanonicalUserFromDuplicates requires at least one row')
  }

  let accountLinkedIds = linkedUserIds
  if (!accountLinkedIds) {
    accountLinkedIds = new Set<string>()
    const accountResult = await db().queryDocs<Record<string, unknown> & { id: string }>({
      collection: 'accounts',
      filters: [{ field: 'provider', operator: '==', value: 'google' }],
      pagination: { limit: 500 },
    })
    if (accountResult.success) {
      for (const account of accountResult.data) {
        const userId = account.userId as string | undefined
        if (userId) accountLinkedIds.add(userId)
      }
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const aLinked = accountLinkedIds!.has(a.id) ? 1 : 0
    const bLinked = accountLinkedIds!.has(b.id) ? 1 : 0
    if (aLinked !== bLinked) return bLinked - aLinked

    const aRole = roleScore(a.role as string | undefined)
    const bRole = roleScore(b.role as string | undefined)
    if (aRole !== bRole) return bRole - aRole

    const aCeo = a.username === 'ceo' ? 1 : 0
    const bCeo = b.username === 'ceo' ? 1 : 0
    if (aCeo !== bCeo) return bCeo - aCeo

    const aCreated = a.createdAt ? new Date(a.createdAt as string).getTime() : 0
    const bCreated = b.createdAt ? new Date(b.createdAt as string).getTime() : 0
    return aCreated - bCreated
  })

  return sorted[0]
}

export type ResolveCanonicalUserInput = {
  id?: string | null
  email?: string | null
}

export type ResolveCanonicalUserResult = {
  canonicalId: string
  userRow: UserRow | null
  created: boolean
}

export async function resolveCanonicalUser(
  input: ResolveCanonicalUserInput
): Promise<ResolveCanonicalUserResult> {
  const normalizedEmail = normalizeAuthEmail(input.email)

  if (input.id) {
    const byId = await db().readDoc<UserRow>('users', input.id)
    if (byId.success && byId.data) {
      return { canonicalId: input.id, userRow: byId.data, created: false }
    }
  }

  if (normalizedEmail) {
    const byEmail = await findUserByEmail(normalizedEmail)
    if (byEmail) {
      if (input.id && input.id !== byEmail.id) {
        console.warn('user_migration_id_mismatch', {
          sessionId: input.id,
          canonicalId: byEmail.id,
          email: normalizedEmail,
        })
      }
      return { canonicalId: byEmail.id, userRow: byEmail, created: false }
    }
  }

  if (!input.id) {
    throw new Error('resolveCanonicalUser: no existing user and no id to create')
  }

  return { canonicalId: input.id, userRow: null, created: false }
}

export async function ensureGoogleAccountLinked(params: {
  userId: string
  providerAccountId: string
  idToken?: string
}): Promise<void> {
  const { userId, providerAccountId, idToken } = params

  const existing = await db().queryDocs<Record<string, unknown> & { id: string }>({
    collection: 'accounts',
    filters: [
      { field: 'provider', operator: '==', value: 'google' },
      { field: 'providerAccountId', operator: '==', value: providerAccountId },
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

  const accountData = {
    userId,
    type: 'oidc',
    provider: 'google',
    providerAccountId,
    id_token: idToken ?? null,
  }

  const result = await db().createDoc('accounts', accountData)
  if (!result.success) {
    console.error('ensureGoogleAccountLinked: failed to link account', result.error)
    throw result.error ?? new Error('Failed to link Google account')
  }
}

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
  const userData = {
    id: params.userId,
    globalUserId: params.userId,
    email: normalizedEmail,
    emailVerified: params.emailVerified ?? null,
    name: params.name ?? null,
    image: params.image ?? null,
    role: params.role ?? DEFAULT_USER_ROLE,
    isVerified: !!params.emailVerified,
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
      language: 'en',
      theme: 'light',
      notifications: false,
    },
  }

  const result = await db().createDoc('users', userData, { id: params.userId })
  if (!result.success) {
    if (isUniqueViolation(result.error)) {
      const existing = await findUserByEmail(normalizedEmail)
      if (existing) return existing
    }
    throw result.error ?? new Error('Failed to create OAuth user')
  }

  return (result.data ?? userData) as UserRow
}

const inFlightByEmail = new Map<string, Promise<string>>()

export async function resolveInFlightByEmail(
  email: string | null | undefined,
  resolver: () => Promise<string>
): Promise<string> {
  const key = normalizeAuthEmail(email)
  if (!key) return resolver()

  const existing = inFlightByEmail.get(key)
  if (existing) return existing

  const promise = resolver().finally(() => {
    inFlightByEmail.delete(key)
  })
  inFlightByEmail.set(key, promise)
  return promise
}
