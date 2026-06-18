import 'server-only'

import { db } from '@/lib/database'
import { mapRowToVerificationProcedure } from '@/features/verification/lib/procedure-mapper'
import type { VerificationProcedure } from '@/features/verification/types/verification-procedure'

const COLLECTION = 'verification_procedures'

export async function getVerificationProcedureByNumber(
  procedureNumber: string,
): Promise<VerificationProcedure | null> {
  const result = await db().findDocById<Record<string, unknown>>(COLLECTION, procedureNumber)
  if (!result.success || !result.data) {
    return null
  }
  return mapRowToVerificationProcedure({
    ...(result.data as Record<string, unknown>),
    id: procedureNumber,
  })
}

export async function getVerificationProceduresForSubject(
  subjectType: string,
  subjectId: string,
): Promise<VerificationProcedure[]> {
  const result = await db().queryDocs<Record<string, unknown>>({
    collection: COLLECTION,
    filters: [
      { field: 'subjectType', operator: '=', value: subjectType },
      { field: 'subjectId', operator: '=', value: subjectId },
    ],
    orderBy: [{ field: 'attemptNumber', direction: 'desc' }],
    pagination: { limit: 20 },
  })

  if (!result.success || !result.data) {
    return []
  }

  return result.data.map((row) =>
    mapRowToVerificationProcedure(row as Record<string, unknown> & { id: string }),
  )
}
