import 'server-only'

import { assertEntityOwnerOrAdmin } from '@/features/entities/lib/assert-entity-owner'
import { syncEntityDiscovery } from '@/features/entities/lib/entity-mutation-sync'
import {
  getOrCreateOpenVerificationProcedure,
  persistVerificationProcedure,
} from '@/features/verification/services/create-verification-procedure'
import {
  submitVerificationProcedure,
} from '@/features/verification/services/attach-verification-documents'
import { notifyVerificationEvent } from '@/features/verification/services/notify-verification'

export class EntityVerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EntityVerificationError'
  }
}

/**
 * Queue an entity for platform verification review via unified verification_procedures SSOT.
 */
export async function requestEntityVerification(
  entityId: string,
  note?: string,
): Promise<{ success: true; status: 'pending'; procedureNumber: string }> {
  const { entity, userId } = await assertEntityOwnerOrAdmin(entityId)

  if (entity.storeVerification?.identityVerified) {
    throw new EntityVerificationError('Entity is already verified')
  }

  if (entity.verificationStatus === 'pending' || entity.verificationStatus === 'under_review') {
    throw new EntityVerificationError('Verification request is already pending review')
  }

  const procedure = await getOrCreateOpenVerificationProcedure({
    subjectType: 'entity_identity',
    subjectId: entityId,
    applicantUserId: userId,
    entityName: entity.name,
    note: note?.trim() || undefined,
  })

  const requestedAt = new Date().toISOString()

  if (procedure.status === 'draft') {
    if (procedure.documents?.length) {
      await submitVerificationProcedure(procedure.procedureNumber, userId)
    } else {
      const submitted = await persistVerificationProcedure({
        ...procedure,
        status: 'submitted',
        submittedAt: requestedAt,
        statusHistory: [
          ...(procedure.statusHistory ?? []),
          { status: 'submitted', at: requestedAt, actorUserId: userId },
        ],
        forensics: [
          ...(procedure.forensics ?? []),
          { at: requestedAt, actorUserId: userId, action: 'submitted_without_documents' },
        ],
      })
      await notifyVerificationEvent({
        type: 'verification.submitted',
        procedureNumber: submitted.procedureNumber,
        subjectType: submitted.subjectType,
        subjectId: submitted.subjectId,
        applicantUserId: userId,
        entityName: submitted.entityName,
      })
    }
  }

  const updateResult = await syncEntityVerificationPending(entityId, requestedAt, procedure.procedureNumber)

  if (!updateResult) {
    throw new EntityVerificationError('Failed to update entity verification status')
  }

  await syncEntityDiscovery({ entityId, event: 'updated' })

  return { success: true, status: 'pending', procedureNumber: procedure.procedureNumber }
}

async function syncEntityVerificationPending(
  entityId: string,
  requestedAt: string,
  procedureNumber: string,
): Promise<boolean> {
  const { db } = await import('@/lib/database')
  const updateResult = await db().updateDoc(
    'entities',
    entityId,
    {
      verificationStatus: 'pending',
      verificationRequestedAt: requestedAt,
      verificationProcedureNumber: procedureNumber,
    },
    { merge: true },
  )
  return updateResult.success
}
