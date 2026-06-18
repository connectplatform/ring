import 'server-only'

import { auth } from '@/auth'
import { UserRole } from '@/features/auth/types'
import { db } from '@/lib/database'
import { EntityPermissionError } from '@/lib/errors'
import {
  createVerificationProcedure,
  persistVerificationProcedure,
  VerificationProcedureError,
} from '@/features/verification/services/create-verification-procedure'

export const ADMIN_MANUAL_VERIFICATION_NOTE = 'verified by human admin manually'

export interface AdminManualUserVerificationInput {
  targetUserId: string
  isVerified: boolean
  adminUserId: string
  adminName?: string | null
  adminEmail: string
  /** ISO timestamp from admin client clock */
  verifiedAtLocal?: string
  /** Human-readable local time string from admin client */
  verifiedAtLocalDisplay?: string
}

export async function assertAdminManualVerificationAccess(): Promise<{
  adminUserId: string
  adminName?: string | null
  adminEmail: string
}> {
  const session = await auth()
  const role = session?.user?.role as UserRole | undefined
  if (!session?.user?.id || (role !== UserRole.admin && role !== UserRole.superadmin)) {
    throw new EntityPermissionError('Admin access required')
  }
  return {
    adminUserId: session.user.id,
    adminName: session.user.name,
    adminEmail: session.user.email || '',
  }
}

export async function setAdminManualUserVerification(
  input: AdminManualUserVerificationInput,
): Promise<{ success: true; procedureNumber?: string; isVerified: boolean }> {
  const userResult = await db().readDoc<Record<string, unknown>>('users', input.targetUserId)
  if (!userResult.success || !userResult.data) {
    throw new VerificationProcedureError('User not found')
  }

  const now = new Date().toISOString()

  if (!input.isVerified) {
    const updateResult = await db().updateDoc(
      'users',
      input.targetUserId,
      {
        isVerified: false,
        kycVerification: {
          status: 'not_started',
          level: 'none',
          verifiedAt: null,
          manualVerification: null,
        },
      },
      { merge: true },
    )

    if (!updateResult.success) {
      throw new VerificationProcedureError('Failed to clear user verification status')
    }

    return { success: true, isVerified: false }
  }

  const procedure = await createVerificationProcedure({
    subjectType: 'user_kyc',
    subjectId: input.targetUserId,
    applicantUserId: input.targetUserId,
    note: ADMIN_MANUAL_VERIFICATION_NOTE,
  })

  const forensicsDetail = {
    note: ADMIN_MANUAL_VERIFICATION_NOTE,
    adminName: input.adminName ?? null,
    adminEmail: input.adminEmail,
    verifiedAtUtc: now,
    verifiedAtLocal: input.verifiedAtLocal ?? null,
    verifiedAtLocalDisplay: input.verifiedAtLocalDisplay ?? null,
  }

  const approved = await persistVerificationProcedure({
    ...procedure,
    status: 'approved',
    submittedAt: now,
    reviewedAt: now,
    completedAt: now,
    reviewerUserId: input.adminUserId,
    note: ADMIN_MANUAL_VERIFICATION_NOTE,
    statusHistory: [
      ...(procedure.statusHistory ?? []),
      {
        status: 'submitted',
        at: now,
        actorUserId: input.adminUserId,
        note: ADMIN_MANUAL_VERIFICATION_NOTE,
      },
      {
        status: 'approved',
        at: now,
        actorUserId: input.adminUserId,
        note: ADMIN_MANUAL_VERIFICATION_NOTE,
      },
    ],
    forensics: [
      ...(procedure.forensics ?? []),
      {
        at: now,
        actorUserId: input.adminUserId,
        action: 'admin_manual_verify',
        detail: forensicsDetail,
      },
    ],
  })

  const updateResult = await db().updateDoc(
    'users',
    input.targetUserId,
    {
      isVerified: true,
      kycVerification: {
        status: 'approved',
        level: 'standard',
        verifiedAt: now,
        procedureNumber: approved.procedureNumber,
        manualVerification: forensicsDetail,
      },
    },
    { merge: true },
  )

  if (!updateResult.success) {
    throw new VerificationProcedureError('Failed to update user verification status')
  }

  return { success: true, procedureNumber: approved.procedureNumber, isVerified: true }
}
