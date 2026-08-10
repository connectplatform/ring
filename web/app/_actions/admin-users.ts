'use server'

import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { db } from '@/lib/database'
import type { AuthUser } from '@/features/auth/types'
import {
  ADMIN_LIST_PAGE_SIZE,
  toIsoString,
  toIsoStringRequired,
} from '@/lib/admin/admin-list-dto'

function mapUserRow(data: Record<string, unknown>): AuthUser {
  const phone =
    (data.phoneNumber as string | undefined) ||
    (data.phone as string | undefined) ||
    ((data.data as Record<string, unknown> | undefined)?.phone as string | undefined) ||
    ((data.data as Record<string, unknown> | undefined)?.phoneNumber as string | undefined) ||
    undefined

  return {
    id: String(data.id ?? ''),
    email: String(data.email ?? ''),
    name: (data.name as string | null) ?? null,
    role: (data.role as AuthUser['role']) ?? 'subscriber',
    isVerified: Boolean(data.isVerified ?? data.is_verified ?? false),
    createdAt: toIsoStringRequired(data.createdAt ?? data.created_at),
    lastLogin: toIsoStringRequired(data.lastLogin ?? data.last_login ?? data.createdAt ?? data.created_at),
    photoURL:
      (data.photoURL as string | null) ??
      (data.image as string | null) ??
      (data.avatar as string | null) ??
      null,
    emailVerified: toIsoString(data.emailVerified) ?? null,
    authProvider: String(data.authProvider ?? 'credentials'),
    authProviderId: String(data.authProviderId ?? data.id ?? ''),
    globalUserId: String(data.global_user_id ?? data.id ?? ''),
    accountStatus: (data.account_status as AuthUser['accountStatus']) ?? 'ACTIVE',
    wallets: Array.isArray(data.wallets) ? data.wallets : [],
    phoneNumber: phone ? String(phone) : undefined,
    phoneVerifiedAt: toIsoString(data.phoneVerifiedAt) ?? undefined,
  } as unknown as AuthUser
}

async function assertAdmin() {
  const session = await auth()
  if (!session?.user) throw new Error('Authentication required')
  if (!isPlatformAdmin(session.user.role)) throw new Error('Admin access required')
  return session
}

export async function listAdminUsersPage(input?: {
  limit?: number
  offset?: number
}): Promise<{
  items: AuthUser[]
  hasMore: boolean
  nextOffset: number
  totalCount: number
}> {
  await assertAdmin()

  const limit = Math.min(Math.max(input?.limit ?? ADMIN_LIST_PAGE_SIZE, 1), 100)
  const offset = Math.max(input?.offset ?? 0, 0)

  const [result, countResult] = await Promise.all([
    db().queryDocs<Record<string, unknown>>({
      collection: 'users',
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      pagination: { limit, offset },
    }),
    db().countDocs('users'),
  ])

  if (!result.success || !result.data) {
    return {
      items: [],
      hasMore: false,
      nextOffset: offset,
      totalCount: countResult.success ? countResult.data ?? 0 : 0,
    }
  }

  const items = result.data.map((row) => mapUserRow(row as Record<string, unknown>))
  const hasMore = items.length >= limit
  return {
    items,
    hasMore,
    nextOffset: hasMore ? offset + items.length : offset,
    totalCount: countResult.success ? countResult.data ?? 0 : items.length,
  }
}

export async function loadMoreAdminUsers(input: { offset: number; limit?: number }) {
  try {
    const page = await listAdminUsersPage(input)
    return { success: true as const, ...page }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to load users',
      items: [] as AuthUser[],
      hasMore: false,
      nextOffset: input.offset ?? 0,
      totalCount: 0,
    }
  }
}
