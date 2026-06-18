import 'server-only'

import { randomUUID } from 'node:crypto'
import { db } from '@/lib/database'
import { allocateProcedureNumber, nextAttemptNumber } from '@/features/verification/lib/procedure-number'
import { mapRowToVerificationProcedure } from '@/features/verification/lib/procedure-mapper'
import type {
  VerificationProcedure,
  VerificationSubjectType,
} from '@/features/verification/types/verification-procedure'

const COLLECTION = 'verification_procedures'

export class VerificationProcedureError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VerificationProcedureError'
  }
}

export interface CreateVerificationProcedureInput {
  subjectType: VerificationSubjectType
  subjectId: string
  applicantUserId: string
  entityName?: string
  note?: string
}

export async function createVerificationProcedure(
  input: CreateVerificationProcedureInput,
): Promise<VerificationProcedure> {
  const procedureNumber = await allocateProcedureNumber()
  const attemptNumber = await nextAttemptNumber(input.subjectType, input.subjectId)
  const now = new Date().toISOString()

  const procedure: VerificationProcedure = {
    id: procedureNumber,
    procedureNumber,
    attemptNumber,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    applicantUserId: input.applicantUserId,
    status: 'draft',
    statusHistory: [{ status: 'draft', at: now, actorUserId: input.applicantUserId }],
    documents: [],
    forensics: [],
    entityName: input.entityName,
    note: input.note,
    createdAt: now,
    updatedAt: now,
  }

  const result = await db().createDoc(COLLECTION, procedure, { id: procedureNumber })
  if (!result.success) {
    throw new VerificationProcedureError(
      result.error?.message || 'Failed to create verification procedure',
    )
  }

  return procedure
}

export async function getOpenVerificationProcedure(
  subjectType: VerificationSubjectType,
  subjectId: string,
): Promise<VerificationProcedure | null> {
  const result = await db().queryDocs<Record<string, unknown>>({
    collection: COLLECTION,
    filters: [
      { field: 'subjectType', operator: '=', value: subjectType },
      { field: 'subjectId', operator: '=', value: subjectId },
    ],
    orderBy: [{ field: 'attemptNumber', direction: 'desc' }],
    pagination: { limit: 5 },
  })

  if (!result.success || !result.data?.length) {
    return null
  }

  for (const row of result.data) {
    const procedure = mapRowToVerificationProcedure(row as Record<string, unknown> & { id: string })
    if (['draft', 'submitted', 'under_review'].includes(procedure.status)) {
      return procedure
    }
  }

  return null
}

export async function getOrCreateOpenVerificationProcedure(
  input: CreateVerificationProcedureInput,
): Promise<VerificationProcedure> {
  const existing = await getOpenVerificationProcedure(input.subjectType, input.subjectId)
  if (existing) {
    return existing
  }
  return createVerificationProcedure(input)
}

export async function persistVerificationProcedure(
  procedure: VerificationProcedure,
): Promise<VerificationProcedure> {
  const updatedAt = new Date().toISOString()
  const payload = { ...procedure, updatedAt }
  const result = await db().updateDoc(COLLECTION, procedure.id, payload, { merge: false })
  if (!result.success) {
    throw new VerificationProcedureError(
      result.error?.message || 'Failed to update verification procedure',
    )
  }
  return { ...payload, updatedAt }
}

export function newVerificationDocumentId(): string {
  return `vdoc_${randomUUID().replace(/-/g, '')}`
}
