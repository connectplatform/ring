import 'server-only'

import { db } from '@/lib/database'
import { computePaginationCursor } from '@/lib/pagination/cursor-pagination'
import type {
  PublicPool,
  PublicPoolContribution,
  PublicPoolDoc,
  PublicPoolSignal,
} from '@/lib/zod/public-pool-schemas'
import { PUBLIC_POOL_COLLECTIONS } from '@/lib/public-pools/constants'
import {
  derivePublicPoolDocumentId,
  derivePublicPoolSignalId,
} from '@/lib/public-pools/pool-slug'

type PoolRow = PublicPool & { id: string }
type SignalRow = PublicPoolSignal & { id: string }
type ContributionRow = PublicPoolContribution & { id: string }

export async function findPoolBySlug(
  cloneId: string,
  poolSlug: string,
): Promise<PoolRow | null> {
  const result = await db().queryDocs<PoolRow>({
    collection: PUBLIC_POOL_COLLECTIONS.pools,
    filters: [
      { field: 'clone_id', operator: '==', value: cloneId },
      { field: 'pool_slug', operator: '==', value: poolSlug },
    ],
    pagination: { limit: 1 },
  })

  if (!result.success || !result.data?.length) {
    return null
  }

  return result.data[0]
}

export async function readPoolById(poolId: string): Promise<PoolRow | null> {
  const result = await db().readDoc<PoolRow>(PUBLIC_POOL_COLLECTIONS.pools, poolId)
  if (!result.success || !result.data) {
    return null
  }
  return { ...result.data, id: poolId }
}

export async function upsertPool(
  cloneId: string,
  poolSlug: string,
  payload: PublicPool,
): Promise<PoolRow> {
  const id = derivePublicPoolDocumentId(cloneId, poolSlug)
  const existing = await readPoolById(id)

  if (existing) {
    const merged: PublicPool = {
      ...existing,
      ...payload,
      clone_id: cloneId,
      pool_slug: poolSlug,
      like_count: existing.like_count,
      pledged_ring: existing.pledged_ring,
      status: existing.status,
      queued_at: existing.queued_at,
      completed_at: existing.completed_at,
      signal_at_completion: existing.signal_at_completion,
    }

    const result = await db().updateDoc(PUBLIC_POOL_COLLECTIONS.pools, id, merged)
    if (!result.success) {
      throw new Error(result.error?.message ?? 'Failed to update public pool')
    }
    return { id, ...merged }
  }

  const result = await db().createDoc(PUBLIC_POOL_COLLECTIONS.pools, payload, { id })
  if (!result.success) {
    throw new Error(result.error?.message ?? 'Failed to create public pool')
  }
  return { id, ...payload }
}

export async function updatePoolFields(
  poolId: string,
  patch: Partial<PublicPool>,
): Promise<PoolRow> {
  const existing = await readPoolById(poolId)
  if (!existing) {
    throw new Error('Public pool not found')
  }

  const next = { ...existing, ...patch }
  const result = await db().updateDoc(PUBLIC_POOL_COLLECTIONS.pools, poolId, next)
  if (!result.success) {
    throw new Error(result.error?.message ?? 'Failed to update public pool')
  }
  return { id: poolId, ...next }
}

export async function findSignalForUser(
  cloneId: string,
  poolId: string,
  userId: string,
): Promise<SignalRow | null> {
  const id = derivePublicPoolSignalId(poolId, userId)
  const result = await db().readDoc<SignalRow>(PUBLIC_POOL_COLLECTIONS.signals, id)
  if (!result.success || !result.data) {
    return null
  }
  return { ...result.data, id }
}

export async function writeSignal(
  signal: PublicPoolSignal,
  signalId: string,
): Promise<SignalRow> {
  const existing = await db().readDoc<SignalRow>(PUBLIC_POOL_COLLECTIONS.signals, signalId)
  if (existing.success && existing.data) {
    const result = await db().updateDoc(PUBLIC_POOL_COLLECTIONS.signals, signalId, signal)
    if (!result.success) {
      throw new Error(result.error?.message ?? 'Failed to update signal')
    }
    return { id: signalId, ...signal }
  }

  const result = await db().createDoc(PUBLIC_POOL_COLLECTIONS.signals, signal, { id: signalId })
  if (!result.success) {
    throw new Error(result.error?.message ?? 'Failed to create signal')
  }
  return { id: signalId, ...signal }
}

export async function findContributionByIdempotency(
  cloneId: string,
  idempotencyKey: string,
): Promise<ContributionRow | null> {
  const result = await db().queryDocs<ContributionRow>({
    collection: PUBLIC_POOL_COLLECTIONS.contributions,
    filters: [
      { field: 'clone_id', operator: '==', value: cloneId },
      { field: 'idempotency_key', operator: '==', value: idempotencyKey },
    ],
    pagination: { limit: 1 },
  })

  if (!result.success || !result.data?.length) {
    return null
  }
  return result.data[0]
}

export async function createContribution(
  contribution: PublicPoolContribution,
  contributionId?: string,
): Promise<ContributionRow> {
  const id = contributionId ?? `ppc_${crypto.randomUUID()}`
  const result = await db().createDoc(PUBLIC_POOL_COLLECTIONS.contributions, contribution, { id })
  if (!result.success) {
    throw new Error(result.error?.message ?? 'Failed to create contribution')
  }
  return { id, ...contribution }
}

export async function updateContribution(
  contributionId: string,
  patch: Partial<PublicPoolContribution>,
): Promise<ContributionRow> {
  const result = await db().readDoc<ContributionRow>(
    PUBLIC_POOL_COLLECTIONS.contributions,
    contributionId,
  )
  if (!result.success || !result.data) {
    throw new Error('Contribution not found')
  }

  const next = { ...result.data, ...patch }
  const update = await db().updateDoc(PUBLIC_POOL_COLLECTIONS.contributions, contributionId, next)
  if (!update.success) {
    throw new Error(update.error?.message ?? 'Failed to update contribution')
  }
  return { id: contributionId, ...next }
}

export async function sumConfirmedContributions(
  cloneId: string,
  poolId: string,
): Promise<string> {
  const result = await db().queryDocs<ContributionRow>({
    collection: PUBLIC_POOL_COLLECTIONS.contributions,
    filters: [
      { field: 'clone_id', operator: '==', value: cloneId },
      { field: 'pool_id', operator: '==', value: poolId },
      { field: 'status', operator: '==', value: 'confirmed' },
    ],
    pagination: { limit: 500 },
  })

  if (!result.success || !result.data) {
    return '0'
  }

  let total = 0
  for (const row of result.data) {
    total += parseFloat(row.amount_ring) || 0
  }

  return total.toFixed(8).replace(/\.?0+$/, '') || '0'
}

export async function deleteSignalsForPool(
  cloneId: string,
  poolId: string,
): Promise<void> {
  const result = await db().queryDocs<SignalRow>({
    collection: PUBLIC_POOL_COLLECTIONS.signals,
    filters: [
      { field: 'clone_id', operator: '==', value: cloneId },
      { field: 'pool_id', operator: '==', value: poolId },
    ],
    pagination: { limit: 500 },
  })

  if (!result.success || !result.data) {
    return
  }

  for (const row of result.data) {
    await db().deleteDoc(PUBLIC_POOL_COLLECTIONS.signals, row.id)
  }
}

export async function deleteContributionsForPool(
  cloneId: string,
  poolId: string,
): Promise<void> {
  const result = await db().queryDocs<ContributionRow>({
    collection: PUBLIC_POOL_COLLECTIONS.contributions,
    filters: [
      { field: 'clone_id', operator: '==', value: cloneId },
      { field: 'pool_id', operator: '==', value: poolId },
    ],
    pagination: { limit: 500 },
  })

  if (!result.success || !result.data) {
    return
  }

  for (const row of result.data) {
    await db().deleteDoc(PUBLIC_POOL_COLLECTIONS.contributions, row.id)
  }
}

export async function deletePoolById(poolId: string): Promise<void> {
  const pool = await readPoolById(poolId)
  if (!pool) {
    throw new Error('Public pool not found')
  }

  await deleteSignalsForPool(pool.clone_id, poolId)
  await deleteContributionsForPool(pool.clone_id, poolId)

  const result = await db().deleteDoc(PUBLIC_POOL_COLLECTIONS.pools, poolId)
  if (!result.success) {
    throw new Error(result.error?.message ?? 'Failed to delete public pool')
  }
}

/** Query public pool rows for the install scope (`clone_id` column). */
export async function queryPublicPools(
  scopeId: string,
  options?: { status?: PublicPool['status']; limit?: number; startAfter?: string },
): Promise<{ pools: PoolRow[]; cursor: string | null; hasMore: boolean }> {
const limit = options?.limit ?? 100
  const filters: Array<{ field: string; operator: string; value: unknown }> = [
    { field: 'clone_id', operator: '==', value: scopeId },
  ]

  if (options?.status) {
    filters.push({ field: 'status', operator: '==', value: options.status })
  }

  if (options?.startAfter) {
    const cursorDoc = await db().findDocById(PUBLIC_POOL_COLLECTIONS.pools, options.startAfter)
    if (cursorDoc.success && cursorDoc.data) {
      const likeCount = (cursorDoc.data as { like_count?: number }).like_count
      if (typeof likeCount === 'number') {
        filters.push({ field: 'like_count', operator: '<', value: likeCount })
      }
    }
  }

  const result = await db().queryDocs<PoolRow>({
    collection: PUBLIC_POOL_COLLECTIONS.pools,
    filters,
    orderBy: [{ field: 'like_count', direction: 'desc' }],
    pagination: { limit },
  })

  if (!result.success || !result.data) {
    return { pools: [], cursor: null, hasMore: false }
  }

  const pools = result.data
  const { nextCursor, hasMore } = computePaginationCursor(pools, limit, (p) => p.id)
  return { pools, cursor: nextCursor, hasMore }
}

export type { PoolRow as PublicPoolRow, ContributionRow as PublicPoolContributionRow }
