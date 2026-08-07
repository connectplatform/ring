import 'server-only'

import { notifyVerificationEvent } from '@/features/verification/services/notify-verification'
import {
  VerificationProcedureError,
  persistVerificationProcedure,
  newVerificationDocumentId,
} from '@/features/verification/services/create-verification-procedure'
import { getVerificationProcedureByNumber } from '@/features/verification/services/get-verification-procedure'
import type { VerificationProcedureDocument } from '@/features/verification/types/verification-procedure'

export interface AttachVerificationDocumentInput {
  procedureNumber: string
  applicantUserId: string
  documentType: string
  objectKey: string
  fileName: string
  contentType?: string
}

export async function attachVerificationDocuments(
  input: AttachVerificationDocumentInput,
): Promise<{ procedureNumber: string; documentId: string }> {
  const procedure = await getVerificationProcedureByNumber(input.procedureNumber)
  if (!procedure) {
    throw new VerificationProcedureError('Verification procedure not found')
  }

  if (procedure.applicantUserId !== input.applicantUserId) {
    throw new VerificationProcedureError('You do not have permission to update this procedure')
  }

  if (!['draft', 'submitted', 'under_review'].includes(procedure.status)) {
    throw new VerificationProcedureError('Procedure is closed and cannot accept new documents')
  }

  const now = new Date().toISOString()
  const document: VerificationProcedureDocument = {
    id: newVerificationDocumentId(),
    documentType: input.documentType,
    objectKey: input.objectKey,
    fileName: input.fileName,
    contentType: input.contentType,
    uploadedAt: now,
    status: 'pending',
  }

  const documents = [...(procedure.documents ?? [])]
  const existingIndex = documents.findIndex((d) => d.documentType === input.documentType)
  if (existingIndex >= 0) {
    documents[existingIndex] = document
  } else {
    documents.push(document)
  }

  const updated = await persistVerificationProcedure({
    ...procedure,
    documents,
    forensics: [
      ...(procedure.forensics ?? []),
      {
        at: now,
        actorUserId: input.applicantUserId,
        action: 'document_attached',
        detail: { documentType: input.documentType, documentId: document.id },
      },
    ],
  })

  return { procedureNumber: updated.procedureNumber, documentId: document.id }
}

export async function submitVerificationProcedure(
  procedureNumber: string,
  applicantUserId: string,
): Promise<{ procedureNumber: string; status: 'submitted' }> {
  const procedure = await getVerificationProcedureByNumber(procedureNumber)
  if (!procedure) {
    throw new VerificationProcedureError('Verification procedure not found')
  }

  if (procedure.applicantUserId !== applicantUserId) {
    throw new VerificationProcedureError('You do not have permission to submit this procedure')
  }

  if (procedure.status !== 'draft') {
    throw new VerificationProcedureError('Only draft procedures can be submitted')
  }

  if (!procedure.documents?.length) {
    throw new VerificationProcedureError('At least one document is required before submission')
  }

  const now = new Date().toISOString()
  const updated = await persistVerificationProcedure({
    ...procedure,
    status: 'submitted',
    submittedAt: now,
    statusHistory: [
      ...(procedure.statusHistory ?? []),
      { status: 'submitted', at: now, actorUserId: applicantUserId },
    ],
    forensics: [
      ...(procedure.forensics ?? []),
      { at: now, actorUserId: applicantUserId, action: 'submitted' },
    ],
  })

  await notifyVerificationEvent({
    type: 'verification.submitted',
    procedureNumber: updated.procedureNumber,
    subjectType: updated.subjectType,
    subjectId: updated.subjectId,
    applicantUserId,
    entityName: updated.entityName,
  })

  return { procedureNumber: updated.procedureNumber, status: 'submitted' }
}
