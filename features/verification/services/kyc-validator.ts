import 'server-only'

import { auth } from '@/auth'
import { UserRole } from '@/features/auth/types'
import { db } from '@/lib/database'
import { EntityPermissionError } from '@/lib/errors'
import { syncEntityDiscovery } from '@/features/entities/lib/entity-mutation-sync'
import {
  VerificationProcedureError,
  persistVerificationProcedure,
} from '@/features/verification/services/create-verification-procedure'
import { getVerificationProcedureByNumber } from '@/features/verification/services/get-verification-procedure'
import { notifyVerificationEvent } from '@/features/verification/services/notify-verification'
import type { VerificationProcedureStatus } from '@/features/verification/types/verification-procedure'

async function assertAdminReviewer(): Promise<string> {
  const session = await auth()
  const role = session?.user?.role as UserRole | undefined
  if (!session?.user?.id || (role !== UserRole.admin && role !== UserRole.superadmin)) {
    throw new EntityPermissionError('Admin access required')
  }
  return session.user.id
}

async function transitionProcedure(
  procedureNumber: string,
  reviewerUserId: string,
  nextStatus: VerificationProcedureStatus,
  action: string,
  extra?: Partial<{
    rejectionReason: string
    note: string
  }>,
): Promise<{ procedureNumber: string; status: VerificationProcedureStatus }> {
  const procedure = await getVerificationProcedureByNumber(procedureNumber)
  if (!procedure) {
    throw new VerificationProcedureError('Verification procedure not found')
  }

  if (!['submitted', 'under_review'].includes(procedure.status)) {
    throw new VerificationProcedureError('Procedure is not in reviewable state')
  }

  const now = new Date().toISOString()
  const completedAt = ['approved', 'rejected'].includes(nextStatus) ? now : procedure.completedAt

  const updated = await persistVerificationProcedure({
    ...procedure,
    status: nextStatus,
    reviewerUserId,
    reviewedAt: ['approved', 'rejected', 'under_review'].includes(nextStatus) ? now : procedure.reviewedAt,
    completedAt,
    rejectionReason: extra?.rejectionReason ?? procedure.rejectionReason,
    note: extra?.note ?? procedure.note,
    statusHistory: [
      ...(procedure.statusHistory ?? []),
      { status: nextStatus, at: now, actorUserId: reviewerUserId, note: extra?.note },
    ],
    forensics: [
      ...(procedure.forensics ?? []),
      {
        at: now,
        actorUserId: reviewerUserId,
        action,
        detail: extra?.rejectionReason ? { rejectionReason: extra.rejectionReason } : undefined,
      },
    ],
  })

  await applySubjectOutcome(updated)
  await notifyVerificationEvent({
    type: `verification.${nextStatus}` as 'verification.approved' | 'verification.rejected' | 'verification.under_review',
    procedureNumber: updated.procedureNumber,
    subjectType: updated.subjectType,
    subjectId: updated.subjectId,
    applicantUserId: updated.applicantUserId,
    entityName: updated.entityName,
    rejectionReason: extra?.rejectionReason,
  })

  return { procedureNumber: updated.procedureNumber, status: updated.status }
}

async function applySubjectOutcome(
  procedure: Awaited<ReturnType<typeof getVerificationProcedureByNumber>> & object,
): Promise<void> {
  if (!procedure) return
  const now = procedure.completedAt || new Date().toISOString()

  if (procedure.subjectType === 'user_kyc') {
    const kycStatus =
      procedure.status === 'approved'
        ? 'approved'
        : procedure.status === 'rejected'
          ? 'rejected'
          : procedure.status === 'under_review'
            ? 'under_review'
            : 'pending'

    await db().updateDoc(
      'users',
      procedure.subjectId,
      {
        kycVerification: {
          status: kycStatus,
          level: procedure.status === 'approved' ? 'standard' : 'none',
          verifiedAt: procedure.status === 'approved' ? now : null,
          procedureNumber: procedure.procedureNumber,
        },
        isVerified: procedure.status === 'approved',
      },
      { merge: true },
    )
    return
  }

  if (procedure.subjectType === 'entity_identity') {
    const verificationStatus =
      procedure.status === 'approved'
        ? 'verified'
        : procedure.status === 'rejected'
          ? 'rejected'
          : procedure.status === 'under_review'
            ? 'under_review'
            : 'pending'

    const patch: Record<string, unknown> = {
      verificationStatus,
      verificationRequestedAt: procedure.submittedAt || procedure.createdAt,
    }

    if (procedure.status === 'approved') {
      patch.verificationCompletedAt = now
      patch.storeVerification = {
        identityVerified: true,
        verifiedAt: now,
        procedureNumber: procedure.procedureNumber,
      }
    }

    await db().updateDoc('entities', procedure.subjectId, patch, { merge: true })
    await syncEntityDiscovery({ entityId: procedure.subjectId, event: 'updated' })
  }
}

export async function approveVerificationProcedure(procedureNumber: string) {
  const reviewerUserId = await assertAdminReviewer()
  return transitionProcedure(procedureNumber, reviewerUserId, 'approved', 'approved')
}

export async function rejectVerificationProcedure(
  procedureNumber: string,
  rejectionReason: string,
) {
  const reviewerUserId = await assertAdminReviewer()
  if (!rejectionReason?.trim()) {
    throw new VerificationProcedureError('Rejection reason is required')
  }
  return transitionProcedure(procedureNumber, reviewerUserId, 'rejected', 'rejected', {
    rejectionReason: rejectionReason.trim(),
  })
}

export async function requestVerificationInfo(
  procedureNumber: string,
  note: string,
) {
  const reviewerUserId = await assertAdminReviewer()
  if (!note?.trim()) {
    throw new VerificationProcedureError('A note is required when requesting more information')
  }
  return transitionProcedure(procedureNumber, reviewerUserId, 'under_review', 'request_info', {
    note: note.trim(),
  })
}

export async function markVerificationUnderReview(procedureNumber: string) {
  const reviewerUserId = await assertAdminReviewer()
  return transitionProcedure(procedureNumber, reviewerUserId, 'under_review', 'under_review')
}

/** Smoke / internal callers — bypasses session auth when reviewerUserId is known. */
export async function reviewVerificationProcedureAs(
  procedureNumber: string,
  reviewerUserId: string,
  action: 'approve' | 'reject' | 'request-info' | 'under-review',
  extra?: { rejectionReason?: string; note?: string },
) {
  switch (action) {
    case 'approve':
      return transitionProcedure(procedureNumber, reviewerUserId, 'approved', 'approved', extra)
    case 'reject':
      if (!extra?.rejectionReason?.trim()) {
        throw new VerificationProcedureError('Rejection reason is required')
      }
      return transitionProcedure(procedureNumber, reviewerUserId, 'rejected', 'rejected', {
        rejectionReason: extra.rejectionReason.trim(),
      })
    case 'request-info':
      if (!extra?.note?.trim()) {
        throw new VerificationProcedureError('A note is required when requesting more information')
      }
      return transitionProcedure(procedureNumber, reviewerUserId, 'under_review', 'request_info', {
        note: extra.note.trim(),
      })
    case 'under-review':
      return transitionProcedure(procedureNumber, reviewerUserId, 'under_review', 'under_review', extra)
    default:
      throw new VerificationProcedureError('Unknown review action')
  }
}
