import 'server-only'

import { db } from '@/lib/database'

const COLLECTION = 'verification_counters'

export async function allocateProcedureNumber(): Promise<string> {
  const year = new Date().getFullYear().toString()
  const counterId = `vrf_counter_${year}`

  const existing = await db().findDocById<{ seq?: number } & { id: string }>(COLLECTION, counterId)
  const nextSeq = (existing.success && existing.data?.seq ? Number(existing.data.seq) : 0) + 1

  const updateResult = await db().updateDoc(
    COLLECTION,
    counterId,
    { seq: nextSeq, year },
    { merge: true },
  )

  if (!updateResult.success) {
    await db().createDoc(COLLECTION, { seq: nextSeq, year }, { id: counterId })
  }

  return `VRF-${year}-${String(nextSeq).padStart(6, '0')}`
}

export async function nextAttemptNumber(
  subjectType: string,
  subjectId: string,
): Promise<number> {
  const result = await db().queryDocs<{ attemptNumber?: number }>({
    collection: 'verification_procedures',
    filters: [
      { field: 'subjectType', operator: '=', value: subjectType },
      { field: 'subjectId', operator: '=', value: subjectId },
    ],
    orderBy: [{ field: 'attemptNumber', direction: 'desc' }],
    pagination: { limit: 1 },
  })

  if (!result.success || !result.data?.length) {
    return 1
  }

  const last = Number(result.data[0].attemptNumber ?? 0)
  return last + 1
}
