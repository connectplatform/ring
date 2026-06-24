import 'server-only'

import { z } from 'zod'
import { normalizeAccountStatus } from '@/features/auth/lib/account-status'
import { VIDEO_VERIFICATION_CHANNELS } from '@/features/auth/types/account-restore'
import { getUserDeviceTelemetrySnapshots } from '@/features/analytics/lib/device-telemetry-db'
import {
  createVerificationProcedure,
  getOpenVerificationProcedure,
  persistVerificationProcedure,
  VerificationProcedureError,
} from '@/features/verification/services/create-verification-procedure'
import { notifyVerificationEvent } from '@/features/verification/services/notify-verification'
import { db } from '@/lib/database'

export const accountRestoreRequestSchema = z.object({
  email: z.string().email().optional(),
  phoneNumber: z.string().max(40).optional(),
  telegramUsername: z.string().max(80).optional(),
  whatsappNumber: z.string().max(40).optional(),
  preferredVideoChannel: z.enum(VIDEO_VERIFICATION_CHANNELS),
  message: z.string().min(10).max(2000),
})

export type AccountRestoreRequestBody = z.infer<typeof accountRestoreRequestSchema>

export async function submitAccountRestoreRequest(
  userId: string,
  body: AccountRestoreRequestBody,
): Promise<{ procedureNumber: string; status: 'submitted' }> {
  const userResult = await db().readDoc<Record<string, unknown>>('users', userId)
  if (!userResult.success || !userResult.data) {
    throw new VerificationProcedureError('User not found')
  }

  const status = normalizeAccountStatus(
    (userResult.data.account_status as string | undefined) ??
      (userResult.data.accountStatus as string | undefined),
  )
  if (status !== 'SUSPENDED') {
    throw new VerificationProcedureError('Only suspended accounts can submit a restore request')
  }

  const existing = await getOpenVerificationProcedure('account_restore', userId)
  if (existing && ['submitted', 'under_review'].includes(existing.status)) {
    return { procedureNumber: existing.procedureNumber, status: 'submitted' }
  }

  const notePayload = {
    type: 'account_restore',
    contact: {
      email: body.email ?? userResult.data.email,
      phoneNumber: body.phoneNumber ?? userResult.data.phoneNumber,
      telegramUsername: body.telegramUsername,
      whatsappNumber: body.whatsappNumber,
    },
    preferredVideoChannel: body.preferredVideoChannel,
    message: body.message,
  }

  const procedure = existing
    ? existing
    : await createVerificationProcedure({
        subjectType: 'account_restore',
        subjectId: userId,
        applicantUserId: userId,
        entityName: 'Account restore',
        note: JSON.stringify(notePayload),
      })

  const now = new Date().toISOString()
  const updated = await persistVerificationProcedure({
    ...procedure,
    note: JSON.stringify(notePayload),
    status: 'submitted',
    submittedAt: now,
    statusHistory: [
      ...(procedure.statusHistory ?? []),
      { status: 'submitted', at: now, actorUserId: userId },
    ],
    forensics: [
      ...(procedure.forensics ?? []),
      { at: now, actorUserId: userId, action: 'account_restore_submitted' },
    ],
  })

  await notifyVerificationEvent({
    type: 'verification.submitted',
    procedureNumber: updated.procedureNumber,
    subjectType: 'account_restore',
    subjectId: userId,
    applicantUserId: userId,
    entityName: 'Account restore',
  })

  return { procedureNumber: updated.procedureNumber, status: 'submitted' }
}

export async function getAccountRestoreProcedureForSession(userId: string) {
  return getOpenVerificationProcedure('account_restore', userId)
}

export async function getAccountRestoreContext(userId: string) {
  const userResult = await db().readDoc<Record<string, unknown>>('users', userId)
  const snapshots = await getUserDeviceTelemetrySnapshots(userId, { limit: 5 })
  return {
    user: userResult.data,
    snapshots,
  }
}
