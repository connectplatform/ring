import 'server-only'

import { db } from '@/lib/database'
import { normalizeAccountStatus } from '@/features/auth/lib/account-status'
import type { AbuseSignal } from '@/features/fraud/types/abuse-candidate'

export const ACCOUNT_STATUS_AUDIT = 'account_status_audit'

export class UserAccountStatusError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserAccountStatusError'
  }
}

export async function revokeAllUserSessions(userId: string): Promise<number> {
  const result = await db().queryDocs<Record<string, unknown> & { id: string }>({
    collection: 'sessions',
    filters: [{ field: 'userId', operator: '==', value: userId }],
    pagination: { limit: 200 },
  })

  if (!result.success || !result.data?.length) {
    return 0
  }

  let deleted = 0
  for (const session of result.data) {
    const del = await db().deleteDoc('sessions', session.id)
    if (del.success) deleted += 1
  }
  return deleted
}

async function appendStatusAudit(entry: Record<string, unknown>): Promise<void> {
  const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  await db().createDoc(ACCOUNT_STATUS_AUDIT, { id, ...entry, createdAt: new Date().toISOString() })
}

export interface SuspendUserInput {
  reason: string
  actorUserId: string
  fraudScore?: number
  signals?: AbuseSignal[]
}

export async function suspendUser(
  userId: string,
  input: SuspendUserInput,
): Promise<{ success: boolean; sessionsRevoked: number }> {
  const userResult = await db().readDoc<Record<string, unknown>>('users', userId)
  if (!userResult.success || !userResult.data) {
    throw new UserAccountStatusError('User not found')
  }

  const now = new Date().toISOString()
  const update = await db().updateDoc(
    'users',
    userId,
    {
      account_status: 'SUSPENDED',
      accountStatus: 'SUSPENDED',
      deactivationReason: input.reason,
      suspendedAt: now,
      suspendedBy: input.actorUserId,
      fraudScoreAtSuspension: input.fraudScore,
      fraudSignalsAtSuspension: input.signals,
    },
    { merge: true },
  )

  if (!update.success) {
    throw new UserAccountStatusError(update.error?.message || 'Failed to suspend user')
  }

  const sessionsRevoked = await revokeAllUserSessions(userId)

  await appendStatusAudit({
    userId,
    action: 'suspend',
    actorUserId: input.actorUserId,
    reason: input.reason,
    fraudScore: input.fraudScore,
    signals: input.signals,
    sessionsRevoked,
    at: now,
  })

  return { success: true, sessionsRevoked }
}

export async function reactivateUser(
  userId: string,
  input: { actorUserId: string; note?: string },
): Promise<{ success: boolean }> {
  const now = new Date().toISOString()
  const update = await db().updateDoc(
    'users',
    userId,
    {
      account_status: 'ACTIVE',
      accountStatus: 'ACTIVE',
      deactivationReason: null,
      suspendedAt: null,
      suspendedBy: null,
      fraudScoreAtSuspension: null,
      fraudSignalsAtSuspension: null,
      reactivatedAt: now,
      reactivatedBy: input.actorUserId,
    },
    { merge: true },
  )

  if (!update.success) {
    throw new UserAccountStatusError(update.error?.message || 'Failed to reactivate user')
  }

  await appendStatusAudit({
    userId,
    action: 'reactivate',
    actorUserId: input.actorUserId,
    note: input.note,
    at: now,
  })

  return { success: true }
}

export async function getUserAccountStatus(userId: string) {
  const result = await db().readDoc<Record<string, unknown>>('users', userId)
  if (!result.success || !result.data) {
    return { status: 'ACTIVE' as const, reason: undefined }
  }
  const status = normalizeAccountStatus(
    (result.data.account_status as string | undefined) ??
      (result.data.accountStatus as string | undefined),
  )
  const reason =
    (result.data.deactivationReason as string | undefined) ??
    (result.data.deactivation_reason as string | undefined)
  return { status, reason }
}
