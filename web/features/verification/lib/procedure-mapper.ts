import type {
  VerificationProcedure,
  VerificationProcedureClientView,
} from '@/features/verification/types/verification-procedure'

export function mapRowToVerificationProcedure(
  row: Record<string, unknown> & { id: string },
): VerificationProcedure {
  const data = row as unknown as VerificationProcedure
  return {
    ...data,
    id: row.id,
    procedureNumber: String(data.procedureNumber ?? row.id),
    attemptNumber: Number(data.attemptNumber ?? 1),
    subjectType: data.subjectType,
    subjectId: String(data.subjectId ?? ''),
    applicantUserId: String(data.applicantUserId ?? ''),
    status: data.status ?? 'draft',
    statusHistory: Array.isArray(data.statusHistory) ? data.statusHistory : [],
    documents: Array.isArray(data.documents) ? data.documents : [],
    forensics: Array.isArray(data.forensics) ? data.forensics : [],
    createdAt: String(data.createdAt ?? new Date().toISOString()),
    updatedAt: String(data.updatedAt ?? new Date().toISOString()),
  }
}

export function toClientView(procedure: VerificationProcedure): VerificationProcedureClientView {
  const procedureNumber = procedure.procedureNumber
  return {
    procedureNumber,
    attemptNumber: procedure.attemptNumber,
    subjectType: procedure.subjectType,
    subjectId: procedure.subjectId,
    status: procedure.status,
    documents: (procedure.documents ?? []).map((doc) => ({
      id: doc.id,
      documentType: doc.documentType,
      fileName: doc.fileName,
      uploadedAt: doc.uploadedAt,
      status: doc.status,
      downloadPath: `/api/verification/documents/${encodeURIComponent(procedureNumber)}/${encodeURIComponent(doc.id)}`,
    })),
    statusHistory: procedure.statusHistory ?? [],
    submittedAt: procedure.submittedAt,
    reviewedAt: procedure.reviewedAt,
    completedAt: procedure.completedAt,
    rejectionReason: procedure.rejectionReason,
    note: procedure.note,
    entityName: procedure.entityName,
    createdAt: procedure.createdAt,
    updatedAt: procedure.updatedAt,
  }
}
