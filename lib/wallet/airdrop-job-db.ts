import 'server-only'

import { db } from '@/lib/database'
import type { AirdropJob, AirdropJobStatus } from '@/lib/zod/airdrop-schemas'

type AirdropJobDoc = AirdropJob & Record<string, unknown> & { id: string }

export async function findAirdropJobByIdempotencyKey(
  idempotencyKey: string,
): Promise<AirdropJobDoc | null> {
  const result = await db().queryDocs<AirdropJobDoc>({
    collection: 'airdrop_jobs',
    filters: [{ field: 'idempotency_key', operator: '==', value: idempotencyKey }],
    pagination: { limit: 1 },
  })

  if (!result.success || !result.data?.length) {
    return null
  }

  return result.data[0]
}

export async function createAirdropJob(job: AirdropJob): Promise<AirdropJobDoc> {
  const id = `airdrop_${crypto.randomUUID()}`
  const payload = {
    ...job,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const result = await db().createDoc('airdrop_jobs', payload, { id })
  if (!result.success) {
    throw new Error(result.error?.message ?? 'Failed to create airdrop job')
  }

  return { id, ...payload }
}

export async function updateAirdropJobStatus(
  jobId: string,
  status: AirdropJobStatus,
  patch: Partial<AirdropJob> = {},
): Promise<void> {
  const result = await db().updateDoc('airdrop_jobs', jobId, {
    status,
    ...patch,
    updated_at: new Date().toISOString(),
  })

  if (!result.success) {
    throw new Error(result.error?.message ?? 'Failed to update airdrop job')
  }
}
