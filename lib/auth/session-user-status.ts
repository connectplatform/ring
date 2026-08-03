import 'server-only'

import { cache } from 'react'
import type { JWT } from 'next-auth/jwt'
import { db } from '@/lib/database'
import type { UserRow } from '@/features/auth/lib/user-row'
import { UserRolesArray, resolvePersistedUserRole } from '@/features/auth/user-role'
import {
  normalizeAccountStatus,
  type NormalizedAccountStatus,
} from '@/features/auth/lib/account-status'

export interface LiveAccountStatus {
  status: NormalizedAccountStatus
  reason?: string
}

/**
 * Per-request deduped live status — use in layout guards, not in global session callback.
 * 
 * Logic review:
 * - If db().readDoc fails or returns no data, it assumes ACTIVE by default. 
 *   This may be dangerous: users who were deleted or never existed will appear ACTIVE.
 *   Ideally, should distinguish between "not found" and "error".
 * - Handles both snake_case and camelCase forms.
 * - If both deactivationReason fields are present, only uses the camelCase.
 */
export const getLiveAccountStatus = cache(
  async (userId: string): Promise<LiveAccountStatus> => {
    const result = await db().readDoc<UserRow>('users', userId)
    if (!result.success) {
      // Could be a database error; we treat as fallback.
      // Consider: Should this return a special status?
      return { status: 'ACTIVE' }
    }

    if (!result.data) {
      // UserId not found. Should this be 'INACTIVE' or error?
      // For now, keeps existing logic.
      return { status: 'ACTIVE' }
    }

    const row = result.data
    return {
      status: normalizeAccountStatus(
        (row.account_status as string | undefined) ??
          (row.accountStatus as string | undefined),
      ),
      reason:
        (row.deactivationReason as string | undefined) ??
        (row.deactivation_reason as string | undefined),
    }
  },
)

/**
 * Apply PostgreSQL user row fields onto the Auth.js JWT (jwt callback only).
 * 
 * Logic review:
 * - Assigns role as either userData.role or fallback to resolveSessionUserRole. If userData.role is null but not undefined, fallback won't run.
 *   The logic with (userData.role as UserRolesArray | undefined) ?? resolveSessionUserRole(userData.role) 
 *   is likely flawed because nullish coalescing only checks for null or undefined, 
 *   but casting to 'UserRolesArray | undefined' does not filter nulls if present in data, so behavior could be off.
 * - Same camelCase/snake_case for account status, deactivation reason.
 */
export function applyUserRowToJwt(token: JWT, userData: UserRow): void {
  // Core identity — required for vitals-onboarding gate recompute on session.update
  if (typeof userData.name === 'string' && userData.name.trim()) {
    token.name = userData.name.trim()
  }
  if (typeof userData.email === 'string' && userData.email.trim()) {
    token.email = userData.email.trim()
  }

  token.username = userData.username as string | undefined
  token.phoneNumber = userData.phoneNumber as string | undefined
  token.bio = userData.bio as string | undefined
  token.organization = userData.organization as string | undefined
  token.position = userData.position as string | undefined
  // Prefer compact chrome avatar when present (matches /profile resolve order)
  token.photoURL = (
    (typeof userData.avatarThumb === 'string' && userData.avatarThumb) ||
    userData.photoURL ||
    userData.image
  ) as string | undefined

  token.role = resolvePersistedUserRole(userData.role)
  
  token.isVerified = Boolean(
    typeof userData.isVerified !== 'undefined'
      ? userData.isVerified
      : userData.is_verified
  )

  token.accountStatus = normalizeAccountStatus(
    (userData.account_status as string | undefined) ??
      (userData.accountStatus as string | undefined),
  )

  token.suspensionReason =
    (userData.deactivationReason as string | undefined) ??
    (userData.deactivation_reason as string | undefined)

  // Telegram UID SSOT — rehydrate from users.data.communication on every JWT refresh
  // so session.telegramId stays accurate after link/unlink without re-login.
  const communication = (userData as { communication?: unknown }).communication
  const telegramIdRaw =
    communication && typeof communication === 'object' && communication !== null
      ? String((communication as Record<string, unknown>).telegramId ?? '').trim()
      : ''
  if (/^\d{3,}$/.test(telegramIdRaw)) {
    token.telegramId = telegramIdRaw
  } else if ('telegramId' in token) {
    delete (token as { telegramId?: string }).telegramId
  }
}

/** Defensive: If JWT is null-ish, should probably indicate explicitly. */
export function accountStatusFromJwt(token: JWT | null | undefined): NormalizedAccountStatus {
  if (!token) {
    // Consider: Should this throw, or default to 'ACTIVE'?
    return 'ACTIVE'
  }
  return normalizeAccountStatus(token.accountStatus as string | undefined)
}

export function suspensionReasonFromJwt(token: JWT | null | undefined): string | undefined {
  if (!token) return undefined
  return token.suspensionReason as string | undefined
}
