import 'server-only'

import type { Session } from 'next-auth'
import {
  accountStatusFromJwt,
  getLiveAccountStatus,
  suspensionReasonFromJwt,
} from '@/lib/auth/session-user-status'
import type { NormalizedAccountStatus } from '@/features/auth/lib/account-status'

export interface ResolvedSessionAccount {
  status: NormalizedAccountStatus
  reason?: string
  source: 'live' | 'jwt'
}

/**
 * Suspension enforcement: live DB read (request-deduped via React cache).
 * Other routes: JWT-cached status from session callback (no extra query).
 */
export async function resolveSessionAccountStatus(
  session: Session,
  options: { live: boolean },
): Promise<ResolvedSessionAccount> {
  const userId = session.user?.id
  if (!userId) {
    return { status: 'ACTIVE', source: 'jwt' }
  }

  if (options.live) {
    const live = await getLiveAccountStatus(userId)
    return { status: live.status, reason: live.reason, source: 'live' }
  }

  const tokenLike = {
    accountStatus: (session.user as { accountStatus?: string }).accountStatus,
    suspensionReason: (session.user as { suspensionReason?: string }).suspensionReason,
  }
  return {
    status: accountStatusFromJwt(tokenLike),
    reason: suspensionReasonFromJwt(tokenLike),
    source: 'jwt',
  }
}
