import 'server-only'

import { auth } from '@/auth'
import { UserRole } from '@/features/auth/types'
import { EntityPermissionError } from '@/lib/errors'
import { db } from '@/lib/database'
import { mapRowToVerificationProcedure, toClientView } from '@/features/verification/lib/procedure-mapper'
import type { VerificationProcedureClientView } from '@/features/verification/types/verification-procedure'
import { VERIFICATION_QUEUE_STATUSES } from '@/features/verification/types/verification-procedure'

export interface VerificationQueueItem {
  procedureNumber: string
  subjectType: string
  subjectId: string
  applicantUserId: string
  status: string
  entityName?: string
  documentCount: number
  submittedAt?: string
  createdAt: string
}

export async function getVerificationQueue(): Promise<VerificationQueueItem[]> {
  const session = await auth()
  const role = session?.user?.role as UserRole | undefined
  if (!session?.user || (role !== UserRole.admin && role !== UserRole.superadmin)) {
    throw new EntityPermissionError('Admin access required')
  }

  const result = await db().queryDocs<Record<string, unknown>>({
    collection: 'verification_procedures',
    orderBy: [{ field: 'submittedAt', direction: 'desc' }],
    pagination: { limit: 300 },
  })

  if (!result.success || !result.data) {
    return []
  }

  return result.data
    .map((row) => {
    const procedure = mapRowToVerificationProcedure(row as Record<string, unknown> & { id: string })
      return {
        procedureNumber: procedure.procedureNumber,
        subjectType: procedure.subjectType,
        subjectId: procedure.subjectId,
        applicantUserId: procedure.applicantUserId,
        status: procedure.status,
        entityName: procedure.entityName,
        documentCount: procedure.documents?.length ?? 0,
        submittedAt: procedure.submittedAt,
        createdAt: procedure.createdAt,
      }
    })
    .filter((item) => VERIFICATION_QUEUE_STATUSES.includes(item.status as (typeof VERIFICATION_QUEUE_STATUSES)[number]))
}

export async function getMyVerificationProcedureView(
  subjectType: string,
): Promise<VerificationProcedureClientView | null> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new EntityPermissionError('Authentication required')
  }

  const result = await db().queryDocs<Record<string, unknown>>({
    collection: 'verification_procedures',
    filters: [
      { field: 'subjectType', operator: '=', value: subjectType },
      { field: 'applicantUserId', operator: '=', value: session.user.id },
    ],
    orderBy: [{ field: 'attemptNumber', direction: 'desc' }],
    pagination: { limit: 1 },
  })

  if (!result.success || !result.data?.length) {
    return null
  }

  const procedure = mapRowToVerificationProcedure(
    result.data[0] as Record<string, unknown> & { id: string },
  )
  return toClientView(procedure)
}
