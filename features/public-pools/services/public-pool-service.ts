import 'server-only'

import { getPublicPoolConfig } from '@/lib/ring-config-core'
import {
  deriveFutureFeaturePoolSlug,
  derivePublicPoolSignalId,
  kebabCase,
} from '@/lib/public-pools/pool-slug'
import {
  fundingProgressPct,
  goalHoursFromImplementationCost,
  goalRingFromHours,
  parseRingDecimal,
} from '@/lib/public-pools/goal-ring'
import type {
  PublicPool,
  PublicPoolAdminCreate,
  PublicPoolAdminUpdate,
  PublicPoolDoc,
  PublicPoolStatsResponse,
} from '@/lib/zod/public-pool-schemas'
import {
  deletePoolById,
  findPoolBySlug,
  findSignalForUser,
  queryPublicPools,
  readPoolById,
  sumConfirmedContributions,
  updatePoolFields,
  upsertPool,
  writeSignal,
} from '@/features/public-pools/lib/public-pool-db'
import {
  executeNativePoolContribution,
  PublicPoolEscrowNotAvailableError,
} from '@/features/public-pools/services/public-pool-contribute'
import { UserRole, hasRoleAtLeast } from '@/features/auth/user-role'

export type FutureFeatureWidgetInput = {
  name: string
  description: string
  implementationCost: number
  labels?: string[]
  poolSlug?: string
}

function assertCanSignal(role: string | null | undefined): void {
  if (!hasRoleAtLeast(role, UserRole.subscriber)) {
    throw new Error('Sign in as a member to like or contribute')
  }
}

function buildStats(pool: PublicPoolDoc, userHasLiked: boolean): PublicPoolStatsResponse {
  const { likeQueueThreshold } = getPublicPoolConfig()
  const fundingPct = fundingProgressPct(pool.pledged_ring, pool.goal_ring)
  const likesPct = Math.min(
    100,
    Math.round((pool.like_count / likeQueueThreshold) * 100),
  )
  const queueEligible =
    pool.status === 'queued' ||
    pool.status === 'in_progress' ||
    pool.status === 'completed' ||
    pool.like_count >= likeQueueThreshold ||
    fundingPct >= 100

  return {
    pool,
    user_has_liked: userHasLiked,
    like_threshold: likeQueueThreshold,
    funding_progress_pct: fundingPct,
    likes_progress_pct: likesPct,
    queue_eligible: queueEligible,
  }
}

export async function listPublicPools(options?: {
  status?: PublicPool['status']
  limit?: number
}): Promise<PublicPoolDoc[]> {
  const { cloneId } = getPublicPoolConfig()
  return queryPublicPools(cloneId, options)
}

export async function ensureFutureFeaturePool(
  docPath: string,
  widget: FutureFeatureWidgetInput,
): Promise<PublicPoolDoc> {
  const { cloneId } = getPublicPoolConfig()
  const poolSlug =
    widget.poolSlug?.trim() ||
    deriveFutureFeaturePoolSlug(docPath, widget.name)

  const goalHours = goalHoursFromImplementationCost(widget.implementationCost)
  const goalRing = goalRingFromHours(goalHours)

  const payload: PublicPool = {
    clone_id: cloneId,
    pool_kind: 'future_feature',
    pool_slug: poolSlug,
    title: widget.name,
    description: widget.description,
    labels: widget.labels ?? [],
    goal_hours: goalHours,
    goal_ring: goalRing,
    funding_mode: 'donation',
    status: 'open',
    like_count: 0,
    pledged_ring: '0',
    doc_path: docPath,
    queued_at: null,
    completed_at: null,
    on_chain: null,
    signal_at_completion: null,
  }

  return upsertPool(cloneId, poolSlug, payload)
}

export async function getPoolStatsBySlug(
  poolSlug: string,
  userId?: string | null,
): Promise<PublicPoolStatsResponse | null> {
  const { cloneId } = getPublicPoolConfig()
  const pool = await findPoolBySlug(cloneId, poolSlug)
  if (!pool) {
    return null
  }

  let userHasLiked = false
  if (userId) {
    const signal = await findSignalForUser(cloneId, pool.id, userId)
    userHasLiked = Boolean(signal?.active)
  }

  return buildStats(pool, userHasLiked)
}

export async function togglePoolLike(
  poolSlug: string,
  userId: string,
  userRole: string | null | undefined,
): Promise<PublicPoolStatsResponse> {
  assertCanSignal(userRole)

  const { cloneId } = getPublicPoolConfig()
  const pool = await findPoolBySlug(cloneId, poolSlug)
  if (!pool) {
    throw new Error('Public pool not found')
  }

  if (pool.status === 'completed' || pool.status === 'cancelled') {
    throw new Error('Pool is closed')
  }

  const signalId = derivePublicPoolSignalId(pool.id, userId)
  const existing = await findSignalForUser(cloneId, pool.id, userId)

  let likeDelta = 0
  let active = true

  if (existing?.active) {
    active = false
    likeDelta = -1
  } else {
    active = true
    likeDelta = 1
  }

  await writeSignal(
    {
      clone_id: cloneId,
      pool_id: pool.id,
      user_id: userId,
      kind: 'like',
      active,
    },
    signalId,
  )

  const nextLikeCount = Math.max(0, pool.like_count + likeDelta)
  const updated = await updatePoolFields(pool.id, { like_count: nextLikeCount })
  const gated = await evaluateQueueGate(updated)

  return buildStats(gated, active)
}

export async function recomputePoolTotals(poolId: string): Promise<PublicPoolDoc> {
  const pool = await readPoolById(poolId)
  if (!pool) {
    throw new Error('Public pool not found')
  }

  const pledged = await sumConfirmedContributions(pool.clone_id, poolId)
  const updated = await updatePoolFields(poolId, { pledged_ring: pledged })
  return evaluateQueueGate(updated)
}

export async function evaluateQueueGate(pool: PublicPoolDoc): Promise<PublicPoolDoc> {
  if (pool.status !== 'open') {
    return pool
  }

  const { likeQueueThreshold } = getPublicPoolConfig()
  const fundingPct = fundingProgressPct(pool.pledged_ring, pool.goal_ring)
  const likesMet = pool.like_count >= likeQueueThreshold
  const fundingMet = fundingPct >= 100

  if (likesMet || fundingMet) {
    return updatePoolFields(pool.id, {
      status: 'queued',
      queued_at: new Date().toISOString(),
    })
  }

  return pool
}

export async function contributeToPool(params: {
  poolSlug: string
  userId: string
  userRole: string | null | undefined
  amountRing: string
  idempotencyKey: string
  fundingMode?: 'donation' | 'escrow'
}): Promise<PublicPoolStatsResponse & { tx_hash: string }> {
  assertCanSignal(params.userRole)

  const { cloneId } = getPublicPoolConfig()
  const pool = await findPoolBySlug(cloneId, params.poolSlug)
  if (!pool) {
    throw new Error('Public pool not found')
  }

  if (pool.status === 'completed' || pool.status === 'cancelled') {
    throw new Error('Pool is closed')
  }

  const amount = parseRingDecimal(params.amountRing)
  if (amount <= 0) {
    throw new Error('Contribution amount must be positive')
  }

  const remaining = parseRingDecimal(pool.goal_ring) - parseRingDecimal(pool.pledged_ring)
  if (amount > remaining && remaining > 0) {
    throw new Error(`Maximum contribution is ${remaining} RING for this pool`)
  }

  const { txHash } = await executeNativePoolContribution({
    userId: params.userId,
    pool,
    amountRing: params.amountRing,
    idempotencyKey: params.idempotencyKey,
    fundingMode: params.fundingMode ?? 'donation',
  })

  const refreshed = await recomputePoolTotals(pool.id)
  const signal = await findSignalForUser(cloneId, pool.id, params.userId)

  return {
    ...buildStats(refreshed, Boolean(signal?.active)),
    tx_hash: txHash,
  }
}

export async function updatePoolStatus(
  poolId: string,
  status: PublicPool['status'],
): Promise<PublicPoolDoc> {
  const pool = await readPoolById(poolId)
  if (!pool) {
    throw new Error('Public pool not found')
  }

  const patch: Partial<PublicPool> = { status }

  if (status === 'completed') {
    patch.completed_at = new Date().toISOString()
    patch.signal_at_completion = pool.like_count
  }

  return updatePoolFields(poolId, patch)
}

function deriveManualPoolSlug(title: string, explicit?: string): string {
  const trimmed = explicit?.trim()
  if (trimmed) {
    return trimmed
  }
  return `manual:${kebabCase(title)}`
}

export async function createAdminPublicPool(
  input: PublicPoolAdminCreate,
): Promise<PublicPoolDoc> {
  const { cloneId } = getPublicPoolConfig()
  const poolSlug = deriveManualPoolSlug(input.title, input.pool_slug)
  const existing = await findPoolBySlug(cloneId, poolSlug)
  if (existing) {
    throw new Error(`Pool slug already exists: ${poolSlug}`)
  }

  const goalRing = goalRingFromHours(input.goal_hours)
  const payload: PublicPool = {
    clone_id: cloneId,
    pool_kind: input.pool_kind,
    pool_slug: poolSlug,
    title: input.title,
    description: input.description,
    labels: input.labels ?? [],
    goal_hours: input.goal_hours,
    goal_ring: goalRing,
    funding_mode: input.funding_mode ?? 'donation',
    status: input.status ?? 'open',
    like_count: 0,
    pledged_ring: '0',
    doc_path: input.doc_path ?? null,
    queued_at: input.status === 'queued' ? new Date().toISOString() : null,
    completed_at: input.status === 'completed' ? new Date().toISOString() : null,
    on_chain: null,
    signal_at_completion: null,
  }

  return upsertPool(cloneId, poolSlug, payload)
}

export async function updateAdminPublicPool(
  poolId: string,
  input: PublicPoolAdminUpdate,
): Promise<PublicPoolDoc> {
  const pool = await readPoolById(poolId)
  if (!pool) {
    throw new Error('Public pool not found')
  }

  const patch: Partial<PublicPool> = {}

  if (input.title !== undefined) patch.title = input.title
  if (input.description !== undefined) patch.description = input.description
  if (input.pool_kind !== undefined) patch.pool_kind = input.pool_kind
  if (input.labels !== undefined) patch.labels = input.labels
  if (input.doc_path !== undefined) patch.doc_path = input.doc_path
  if (input.funding_mode !== undefined) patch.funding_mode = input.funding_mode

  if (input.goal_hours !== undefined) {
    patch.goal_hours = input.goal_hours
    patch.goal_ring = goalRingFromHours(input.goal_hours)
  }

  if (input.status !== undefined) {
    patch.status = input.status
    if (input.status === 'completed' && !pool.completed_at) {
      patch.completed_at = new Date().toISOString()
      patch.signal_at_completion = pool.like_count
    }
    if (input.status === 'queued' && !pool.queued_at) {
      patch.queued_at = new Date().toISOString()
    }
  }

  if (Object.keys(patch).length === 0) {
    return pool
  }

  return updatePoolFields(poolId, patch)
}

export async function deleteAdminPublicPool(poolId: string): Promise<void> {
  await deletePoolById(poolId)
}

export async function getPublicPoolById(poolId: string): Promise<PublicPoolDoc | null> {
  return readPoolById(poolId)
}

export { PublicPoolEscrowNotAvailableError }
