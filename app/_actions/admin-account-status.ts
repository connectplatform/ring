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

// Main schema for validating the request body from admin actions.
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

// Success types for response results.
type AdminAccountStatusSuccess =
  | { success: true; status: 'SUSPENDED'; sessionsRevoked: number }
  | { success: true; status: 'ACTIVE' }

// Union of possible result payload shapes.
type AdminAccountStatusResult =
  | AdminAccountStatusSuccess
  | { success: false; error: string; statusCode: number }

// Sends a suspension notification to the user via the tunnel channel.
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

// Sends a reactivation notification to the user via the tunnel channel.
export const sendAccountReactivateNotification = async (userId: string): Promise<void> => {
  const message: AccountReactivateNotification = {
    type: 'account-reactivate-notification',
    accountStatus: 'ACTIVE' as const,
    at: new Date().toISOString(),
  }
  await publishToUserTunnel(userId, ACCOUNT_STATUS_TUNNEL_CHANNEL, message)
}

/**
 * Orchestrates admin-driven suspend/reactivate actions for a user account.
 * Used by PUT /api/admin/users/[id]/status and directly within server actions.
 * Fraud desk GUI uses the HTTP route, not this action directly.
 *
 * @param targetUserId - The user whose status is being updated.
 * @param body - Payload matching AdminAccountStatusBody.
 * @returns Result shape indicating success or error.
 */
export async function updateAdminUserAccountStatus(
  targetUserId: string,
  body: AdminAccountStatusBody,
): Promise<AdminAccountStatusResult> {
  // Authenticate session and check admin privileges.
  const session = await auth()
  if (!session?.user || !isPlatformAdmin(session.user.role)) {
    // User is not logged in or lacks admin rights.
    return { success: false, error: 'Unauthorized', statusCode: 401 }
  }

  // Prevent admins from changing their own account status.
  if (session.user.id === targetUserId) {
    return {
      success: false,
      error: 'Cannot change your own account status',
      statusCode: 400,
    }
  }

  try {
    if (body.status === 'SUSPENDED') {
      // Suspension requires a non-empty reason.
      if (!body.reason?.trim()) {
        return { success: false, error: 'Suspension reason is required', statusCode: 400 }
      }

      const reason = body.reason.trim()
      // Attempt to suspend user, pass along optional fraudScore and signals for auditing/fraud triage.
      const result = await suspendUser(targetUserId, {
        reason,
        actorUserId: session.user.id,
        fraudScore: body.fraudScore,
        signals: body.signals as AbuseSignal[] | undefined,
      })

      // Notify the suspended user via tunnel.
      await sendAccountSuspendNotification(targetUserId, {
        reason,
        fraudScore: body.fraudScore,
      })

      // Success: return status and how many sessions were revoked.
      return { success: true, status: 'SUSPENDED', sessionsRevoked: result.sessionsRevoked }
    }

    if (body.status === 'ACTIVE') {
      // Reactivation path: reactivate the user and optionally log a note (reason).
      await reactivateUser(targetUserId, {
        actorUserId: session.user.id,
        note: body.reason,
      })
      // Notify the user of reactivation.
      await sendAccountReactivateNotification(targetUserId)
      return { success: true, status: 'ACTIVE' }
    }

    // DEACTIVATED is not handled via this endpoint currently.
    return {
      success: false,
      error: 'DEACTIVATED status is not implemented via this endpoint yet',
      statusCode: 501,
    }
  } catch (error) {
    // Handle domain-specific user account status errors.
    if (error instanceof UserAccountStatusError) {
      return { success: false, error: error.message, statusCode: 400 }
    }
    // Unknown error: rethrow for higher-level error handling/logging.
    throw error
  }
}

// TODO: When React 19/Next 16 adapts server action mutation conventions, consider
//   - using new server mutate patterns for optimistic UI updates and error boundaries
//   - streaming incremental error feedback via server actions (possibly with Channel/subscribe primitives)
//   - stricter schema enforcement at runtime using nested validation
//   - automatically generating API types via schema for UI consumption