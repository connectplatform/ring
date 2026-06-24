'use server'

import { z } from 'zod'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import {
  suspendUser,
  reactivateUser,
  UserAccountStatusError,
} from '@/features/auth/services/user-account-status'
import type { AbuseSignal } from '@/features/fraud/types/abuse-candidate'
import { publishToUserTunnel } from '@/lib/tunnel/publisher'
import {
  ACCOUNT_STATUS_TUNNEL_CHANNEL,
  type AccountReactivateNotification,
  type AccountSuspendNotification,
} from '@/lib/tunnel/account-status-channels'

// Move all types, schema, and helpers to non-exported, or inline types
const adminAccountStatusBodySchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']),
  reason: z.string().max(2000).optional(),
  fraudScore: z.number().min(0).max(100).optional(),
  signals: z
    .array(
      z.object({
        code: z.string(),
        points: z.number(),
        detail: z.string(),
      }),
    )
    .optional(),
})

type AdminAccountStatusBody = z.infer<typeof adminAccountStatusBodySchema>

type AdminAccountStatusSuccess =
  | { success: true; status: 'SUSPENDED'; sessionsRevoked: number }
  | { success: true; status: 'ACTIVE' }

type AdminAccountStatusResult =
  | AdminAccountStatusSuccess
  | { success: false; error: string; statusCode: number }

const sendAccountSuspendNotification = async (
  userId: string,
  payload: Pick<AccountSuspendNotification, 'reason' | 'fraudScore'>,
): Promise<void> => {
  const message: AccountSuspendNotification = {
    type: 'account-suspend-notification',
    accountStatus: 'SUSPENDED',
    reason: payload.reason,
    redirectTo: '/account/suspended',
    at: new Date().toISOString(),
    ...(payload.fraudScore !== undefined ? { fraudScore: payload.fraudScore } : {}),
  }
  await publishToUserTunnel(userId, ACCOUNT_STATUS_TUNNEL_CHANNEL, message)
}

export const sendAccountReactivateNotification = async (userId: string): Promise<void> => {
  const message: AccountReactivateNotification = {
    type: 'account-reactivate-notification',
    accountStatus: 'ACTIVE' as const,
    at: new Date().toISOString(),
  }
  await publishToUserTunnel(userId, ACCOUNT_STATUS_TUNNEL_CHANNEL, message)
}

/**
 * Admin suspend / reactivate orchestration — shared by PUT /api/admin/users/[id]/status
 * and any other server callers. Fraud desk admin GUI uses the HTTP route (not this action directly).
 */
export async function updateAdminUserAccountStatus(
  targetUserId: string,
  body: AdminAccountStatusBody,
): Promise<AdminAccountStatusResult> {
  const session = await auth()
  if (!session?.user || !isPlatformAdmin(session.user.role)) {
    return { success: false, error: 'Unauthorized', statusCode: 401 }
  }

  if (session.user.id === targetUserId) {
    return {
      success: false,
      error: 'Cannot change your own account status',
      statusCode: 400,
    }
  }

  try {
    if (body.status === 'SUSPENDED') {
      if (!body.reason?.trim()) {
        return { success: false, error: 'Suspension reason is required', statusCode: 400 }
      }

      const reason = body.reason.trim()
      const result = await suspendUser(targetUserId, {
        reason,
        actorUserId: session.user.id,
        fraudScore: body.fraudScore,
        signals: body.signals as AbuseSignal[] | undefined,
      })

      await sendAccountSuspendNotification(targetUserId, {
        reason,
        fraudScore: body.fraudScore,
      })

      return { success: true, status: 'SUSPENDED', sessionsRevoked: result.sessionsRevoked }
    }

    if (body.status === 'ACTIVE') {
      await reactivateUser(targetUserId, {
        actorUserId: session.user.id,
        note: body.reason,
      })
      await sendAccountReactivateNotification(targetUserId)
      return { success: true, status: 'ACTIVE' }
    }

    return {
      success: false,
      error: 'DEACTIVATED status is not implemented via this endpoint yet',
      statusCode: 501,
    }
  } catch (error) {
    if (error instanceof UserAccountStatusError) {
      return { success: false, error: error.message, statusCode: 400 }
    }
    throw error
  }
}
