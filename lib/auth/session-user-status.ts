import 'server-only'

import { cache } from 'react'
import type { JWT } from 'next-auth/jwt'
import { db } from '@/lib/database'
import type { UserRow } from '@/features/auth/lib/user-row'
import { UserRole } from '@/features/auth/types'
import {
  normalizeAccountStatus,
  type NormalizedAccountStatus,
} from '@/features/auth/lib/account-status'

export interface LiveAccountStatus {
  status: NormalizedAccountStatus
  reason?: string
}

/** Per-request deduped live status — use in layout guards, not in global session callback. */
export const getLiveAccountStatus = cache(
  async (userId: string): Promise<LiveAccountStatus> => {
    const result = await db().readDoc<UserRow>('users', userId)
    if (!result.success || !result.data) {
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

/** Apply PostgreSQL user row fields onto the Auth.js JWT (jwt callback only). */
export function applyUserRowToJwt(token: JWT, userData: UserRow): void {
  token.username = userData.username as string | undefined
  token.phoneNumber = userData.phoneNumber as string | undefined
  token.bio = userData.bio as string | undefined
  token.organization = userData.organization as string | undefined
  token.position = userData.position as string | undefined
  token.photoURL = (userData.photoURL || userData.image) as string | undefined
  token.role = (userData.role as UserRole | undefined) ?? UserRole.subscriber
  token.isVerified = Boolean(userData.isVerified ?? userData.is_verified)
  token.accountStatus = normalizeAccountStatus(
    (userData.account_status as string | undefined) ??
      (userData.accountStatus as string | undefined),
  )
  token.suspensionReason =
    (userData.deactivationReason as string | undefined) ??
    (userData.deactivation_reason as string | undefined)
}

export function accountStatusFromJwt(token: JWT | null | undefined): NormalizedAccountStatus {
  return normalizeAccountStatus(token?.accountStatus as string | undefined)
}

export function suspensionReasonFromJwt(token: JWT | null | undefined): string | undefined {
  return token?.suspensionReason as string | undefined
}
