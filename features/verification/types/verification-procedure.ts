export type VerificationSubjectType = 'user_kyc' | 'entity_identity' | 'vendor_store'

export type VerificationProcedureStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'expired'

export type VerificationDocumentStatus = 'pending' | 'accepted' | 'rejected'

export interface VerificationStatusHistoryEntry {
  status: VerificationProcedureStatus | string
  at: string
  actorUserId?: string
  note?: string
}

export interface VerificationProcedureDocument {
  id: string
  documentType: string
  objectKey: string
  fileName: string
  contentType?: string
  uploadedAt: string
  status: VerificationDocumentStatus
}

export interface VerificationForensicsEntry {
  at: string
  actorUserId: string
  action: string
  detail?: Record<string, unknown>
}

export interface VerificationProcedure {
  id: string
  procedureNumber: string
  attemptNumber: number
  subjectType: VerificationSubjectType
  subjectId: string
  applicantUserId: string
  status: VerificationProcedureStatus
  statusHistory: VerificationStatusHistoryEntry[]
  documents: VerificationProcedureDocument[]
  forensics: VerificationForensicsEntry[]
  reviewerUserId?: string
  rejectionReason?: string
  submittedAt?: string
  reviewedAt?: string
  completedAt?: string
  note?: string
  entityName?: string
  createdAt: string
  updatedAt: string
}

/** Client-safe procedure view (no raw objectKey URLs). */
export interface VerificationProcedureClientView {
  procedureNumber: string
  attemptNumber: number
  subjectType: VerificationSubjectType
  subjectId: string
  status: VerificationProcedureStatus
  documents: Array<{
    id: string
    documentType: string
    fileName: string
    uploadedAt: string
    status: VerificationDocumentStatus
    downloadPath: string
  }>
  statusHistory: VerificationStatusHistoryEntry[]
  submittedAt?: string
  reviewedAt?: string
  completedAt?: string
  rejectionReason?: string
  note?: string
  entityName?: string
  createdAt: string
  updatedAt: string
}

export const VERIFICATION_OPEN_STATUSES: VerificationProcedureStatus[] = [
  'draft',
  'submitted',
  'under_review',
]

export const VERIFICATION_QUEUE_STATUSES: VerificationProcedureStatus[] = [
  'submitted',
  'under_review',
]
