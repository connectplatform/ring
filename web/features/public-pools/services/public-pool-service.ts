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
import { UserRolesArray, hasRoleAtLeast } from '@/features/auth/user-role'

// Type for widget-based creation of future feature pool UI
export type FutureFeatureWidgetInput = {
  name: string
  description: string
  implementationCost: number
  labels?: string[]
  poolSlug?: string
}

// Throws if user's role isn't at least subscriber (not signed in)
function assertCanSignal(role: UserRolesArray | null | undefined): void {
  if (!hasRoleAtLeast(role as UserRolesArray, UserRolesArray.subscriber)) {
    throw new Error('Sign in as a member to like or contribute')
  }
}

// Calculates and assembles pool stats response object for client-side widgets
function buildStats(pool: PublicPoolDoc, userHasLiked: boolean): PublicPoolStatsResponse {
  const { likeQueueThreshold } = getPublicPoolConfig()
  const fundingPct = fundingProgressPct(pool.pledged_native_token, pool.goal_native_token)
  // Clamp likes percentage for display (never more than 100)
  const likesPct = Math.min(
    100,
    Math.round((pool.like_count / likeQueueThreshold) * 100),
  )
  // Pool is eligible to be queued if in one of the active/completed statuses, OR thresholds met
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

// Fetches a list of public pools filtered optionally by status & limit
export async function listPublicPools(options?: {
  status?: PublicPool['status']
  limit?: number
  startAfter?: string
}): Promise<PublicPoolDoc[]> {
  const { cloneId } = getPublicPoolConfig()
  const page = await queryPublicPools(cloneId, options)
  return page.pools
}

export async function listPublicPoolsPage(options?: {
  status?: PublicPool['status']
  limit?: number
  startAfter?: string
}): Promise<{ pools: PublicPoolDoc[]; cursor: string | null; hasMore: boolean }> {
  const { cloneId } = getPublicPoolConfig()
  return queryPublicPools(cloneId, options)
}

// Ensures a "future feature" pool exists for a doc path, creating if missing
export async function ensureFutureFeaturePool(
  docPath: string,
  widget: FutureFeatureWidgetInput,
): Promise<PublicPoolDoc> {
  const { cloneId } = getPublicPoolConfig()
  // Prioritize provided slug, else derive from input
  const poolSlug =
    widget.poolSlug?.trim() ||
    deriveFutureFeaturePoolSlug(docPath, widget.name)

  // Convert implementation cost to hours and then RING
  const goalHours = goalHoursFromImplementationCost(widget.implementationCost)
  const goalRing = goalRingFromHours(goalHours)

  // Compose new public pool object, defaults preset for future feature pools
  const payload: PublicPool = {
    clone_id: cloneId,
    pool_kind: 'future_feature',
    pool_slug: poolSlug,
    title: widget.name,
    description: widget.description,
    labels: widget.labels ?? [],
    goal_hours: goalHours,
    goal_native_token: goalRing,
    funding_mode: 'donation',
    status: 'open',
    like_count: 0,
    pledged_native_token: '0',
    doc_path: docPath,
    queued_at: null,
    completed_at: null,
    on_chain: null,
    signal_at_completion: null,
  }

  return upsertPool(cloneId, poolSlug, payload)
}

// Returns public pool stats, and whether user has liked/liked pool
export async function getPoolStatsBySlug(
  poolSlug: string,
  userId?: string | null,
): Promise<PublicPoolStatsResponse | null> {
  const { cloneId } = getPublicPoolConfig()
  // Fetch the pool by slug, return null if not found
  const pool = await findPoolBySlug(cloneId, poolSlug)
  if (!pool) {
    return null
  }

  // Optionally check if given user has liked the pool
  let userHasLiked = false
  if (userId) {
    const signal = await findSignalForUser(cloneId, pool.id, userId)
    userHasLiked = Boolean(signal?.active)
  }

  return buildStats(pool, userHasLiked)
}

// Toggle a like for a pool. Returns pool stats with like updates reflected.
export async function togglePoolLike(
  poolSlug: string,
  userId: string,
  userRole: UserRolesArray | null | undefined,
): Promise<PublicPoolStatsResponse> {
  assertCanSignal(userRole)

  const { cloneId } = getPublicPoolConfig()
  // Fetch pool (must exist)
  const pool = await findPoolBySlug(cloneId, poolSlug)
  if (!pool) {
    throw new Error('Public pool not found')
  }

  // Disallow actions if pool closed/completed
  if (pool.status === 'completed' || pool.status === 'cancelled') {
    throw new Error('Pool is closed')
  }

  const signalId = derivePublicPoolSignalId(pool.id, userId)
  const existing = await findSignalForUser(cloneId, pool.id, userId)

  let likeDelta = 0
  let active = true

  // If signal exists and is active, unlike; else, like
  if (existing?.active) {
    active = false
    likeDelta = -1
  } else {
    active = true
    likeDelta = 1
  }

  // Write new like signal for the user/pool
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

  // Calculate next like count with clamp (non-negative)
  const nextLikeCount = Math.max(0, pool.like_count + likeDelta)
  // Persist new like tally to pool doc
  const updated = await updatePoolFields(pool.id, { like_count: nextLikeCount })
  // Re-evaluate queue eligibility after updated like count
  const gated = await evaluateQueueGate(updated)

  return buildStats(gated, active)
}

// Updates a pool's pledged_native_token amount sum and checks queue eligibility
export async function recomputePoolTotals(poolId: string): Promise<PublicPoolDoc> {
  const pool = await readPoolById(poolId)
  if (!pool) {
    throw new Error('Public pool not found')
  }

  // Sum all "confirmed" contributions for this pool
  const pledged = await sumConfirmedContributions(pool.clone_id, poolId)
  // Patch new pledged total
  const updated = await updatePoolFields(poolId, { pledged_native_token: pledged })
  // Re-check queue threshold since pledge may cross above 100%
  return evaluateQueueGate(updated)
}

// Evaluates whether a pool should be updated to queued based on stats
export async function evaluateQueueGate(pool: PublicPoolDoc): Promise<PublicPoolDoc> {
  // Funding 100% → complete + builder payout (donation path)
  const fundingPct = fundingProgressPct(pool.pledged_native_token, pool.goal_native_token)
  if (fundingPct >= 100 && pool.status !== 'completed' && pool.status !== 'cancelled') {
    return maybeAutoCompleteOnFunding(pool)
  }

  // Only "open" pools should be auto-queued via likes. Others are ignored.
  if (pool.status !== 'open') {
    return pool
  }

  const { likeQueueThreshold } = getPublicPoolConfig()
  const likesMet = pool.like_count >= likeQueueThreshold

  if (likesMet) {
    return updatePoolFields(pool.id, {
      status: 'queued',
      queued_at: new Date().toISOString(),
    })
  }

  return pool
}

// Handles user contributions (donation/escrow) to a given pool
export async function contributeToPool(params: {
  poolSlug: string
  userId: string
  userRole: UserRolesArray | null | undefined
  amountNativeToken: string
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

  // Validate amount can be parsed and is positive
  const amount = parseRingDecimal(params.amountNativeToken)
  if (amount <= 0) {
    throw new Error('Contribution amount must be positive')
  }

  // Don't allow user to overfund pool
  const remaining = parseRingDecimal(pool.goal_native_token) - parseRingDecimal(pool.pledged_native_token)
  if (amount > remaining && remaining > 0) {
    throw new Error(`Maximum contribution is ${remaining} RING for this pool`)
  }

  // Actually execute contribution and process transaction (could be escrow or direct)
  const { txHash } = await executeNativePoolContribution({
    userId: params.userId,
    pool,
    amountNativeToken: params.amountNativeToken,
    idempotencyKey: params.idempotencyKey,
    fundingMode: params.fundingMode ?? 'donation',
  })

  // Refresh pool stats after contribution is processed and saved
  const refreshed = await recomputePoolTotals(pool.id)

  // TD-UX-05: keep open dao_jar chat bubbles in sync with pool totals
  try {
    const { refreshOpenDaoJarMessages } = await import(
      '@/features/chat/lib/refresh-open-dao-jar-messages'
    )
    await refreshOpenDaoJarMessages(params.poolSlug, {
      contributorUserId: params.userId,
      lastContribution: {
        userId: params.userId,
        amountNativeToken: params.amountNativeToken,
        rail: 'native_token',
        at: new Date().toISOString(),
      },
    })
  } catch {
    // Non-fatal — domain contribution already succeeded
  }

  // Check like state after contribution for the calling user
  const signal = await findSignalForUser(cloneId, pool.id, params.userId)

  return {
    ...buildStats(refreshed, Boolean(signal?.active)),
    tx_hash: txHash,
  }
}

// Admin-side: update a public pool's status or completion timestamp
export async function updatePoolStatus(
  poolId: string,
  status: PublicPool['status'],
): Promise<PublicPoolDoc> {
  const pool = await readPoolById(poolId)
  if (!pool) {
    throw new Error('Public pool not found')
  }

  const patch: Partial<PublicPool> = { status }

  // If marking as completed, set date and snapshot like count at completion
  if (status === 'completed') {
    patch.completed_at = new Date().toISOString()
    patch.signal_at_completion = pool.like_count
  }

  const updated = await updatePoolFields(poolId, patch)

  // TD-MONEY-02: optional accounting payout to builder wallet from clone treasury
  if (status === 'completed') {
    try {
      await maybePayoutBuilderOnComplete(updated)
    } catch (error) {
      // Non-fatal for status transition — surface via logs; admin can retry
      const { logger } = await import('@/lib/logger')
      logger.error('Builder payout on complete failed', {
        poolId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return readPoolById(poolId).then((p) => p ?? updated)
}

/**
 * Accounting payout: transfer (pledged − platform fee) RING from treasury to
 * builder / opportunity-owner native wallet. Fee from publicPools.platformFeePercentByRole.
 */
async function maybePayoutBuilderOnComplete(pool: PublicPoolDoc): Promise<void> {
  if (pool.payout_tx_hash) return

  let walletAddress = pool.payout_wallet_address?.trim() || ''
  const builderUserId = pool.builder_user_id?.trim() || ''

  if (!walletAddress && builderUserId) {
    const { getNativeWallet } = await import('@/lib/wallet/user-wallet-db')
    const { getNativeChain } = await import('@/lib/ring-config-chain')
    const wallet = await getNativeWallet(builderUserId, getNativeChain())
    walletAddress = wallet?.address?.trim() || ''
    if (walletAddress) {
      await updatePoolFields(pool.id, { payout_wallet_address: walletAddress })
    }
  }
  if (!walletAddress) return

  const pledged = parseRingDecimal(pool.pledged_native_token)
  if (pledged <= 0) return

  let builderRole: string | null = null
  if (builderUserId) {
    try {
      const { getUserRole } = await import('@/features/auth/services/user-management')
      builderRole = await getUserRole(builderUserId)
    } catch {
      builderRole = null
    }
  }

  const {
    resolveBuilderPlatformFeePercent,
    applyPlatformFeeToPledged,
  } = await import('@/features/public-pools/lib/public-pool-platform-fee')
  const feePercent = resolveBuilderPlatformFeePercent(builderRole)
  const { net, fee } = applyPlatformFeeToPledged(pool.pledged_native_token, feePercent)
  if (net <= 0) return

  const netUi = net.toFixed(8)
  const { nativeTokenUiToRaw } = await import('@/lib/wallet/native-token-amount')
  const { transferTokenFromTreasury } = await import(
    '@/features/wallet/chains/solana/treasury-transfer-service'
  )
  const { createWalletTransaction } = await import('@/lib/wallet/wallet-transaction-db')
  const { getNativeChain, getNativeTokenSymbol } = await import('@/lib/ring-config-chain')

  const amountRaw = nativeTokenUiToRaw(netUi)
  if (amountRaw <= 0n) return

  const { txHash, fromAddress } = await transferTokenFromTreasury(walletAddress, amountRaw)

  await updatePoolFields(pool.id, {
    payout_tx_hash: txHash,
    payout_at: new Date().toISOString(),
  })

  await createWalletTransaction({
    kind: 'public_pool_payout',
    txHash,
    userId: builderUserId || 'system',
    fromAddress,
    toAddress: walletAddress,
    amount: netUi,
    tokenSymbol: getNativeTokenSymbol(),
    chain: getNativeChain(),
    notes: `pool_payout:${pool.id};gross=${pool.pledged_native_token};fee=${fee.toFixed(8)};feePct=${feePercent}`,
  })
}

/**
 * When funding hits 100%: queue + optionally auto-complete with builder payout
 * (donation accounting path — escrow finalize is on-chain).
 */
async function maybeAutoCompleteOnFunding(pool: PublicPoolDoc): Promise<PublicPoolDoc> {
  const { autoPayoutOnGoalMet } = getPublicPoolConfig()
  if (!autoPayoutOnGoalMet) return pool
  if (pool.status === 'completed' || pool.status === 'cancelled') return pool

  const fundingPct = fundingProgressPct(pool.pledged_native_token, pool.goal_native_token)
  if (fundingPct < 100) return pool

  const patch: Partial<PublicPool> = {
    status: 'completed',
    completed_at: new Date().toISOString(),
    signal_at_completion: pool.like_count,
  }
  if (pool.status === 'open') {
    patch.queued_at = pool.queued_at ?? new Date().toISOString()
  }
  const updated = await updatePoolFields(pool.id, patch)
  try {
    await maybePayoutBuilderOnComplete(updated)
  } catch (error) {
    const { logger } = await import('@/lib/logger')
    logger.error('Auto builder payout on goal-met failed', {
      poolId: pool.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
  return readPoolById(pool.id).then((p) => p ?? updated)
}

// Derives slug for manual pools from the given title unless explicit given
function deriveManualPoolSlug(title: string, explicit?: string): string {
  const trimmed = explicit?.trim()
  if (trimmed) {
    return trimmed
  }
  return `manual:${kebabCase(title)}`
}

// Admin-only: create a public pool. Throws if slug exists already.
export async function createAdminPublicPool(
  input: PublicPoolAdminCreate,
): Promise<PublicPoolDoc> {
  const { cloneId } = getPublicPoolConfig()
  const poolSlug = deriveManualPoolSlug(input.title, input.pool_slug)
  // Ensure no slug collision
  const existing = await findPoolBySlug(cloneId, poolSlug)
  if (existing) {
    throw new Error(`Pool slug already exists: ${poolSlug}`)
  }

  // Convert goal hours to RING for consistency with regular pools
  const goalRing = goalRingFromHours(input.goal_hours)
  // Construct pool doc (manual customization supported)
  const payload: PublicPool = {
    clone_id: cloneId,
    pool_kind: input.pool_kind,
    pool_slug: poolSlug,
    title: input.title,
    description: input.description,
    labels: input.labels ?? [],
    goal_hours: input.goal_hours,
    goal_native_token: goalRing,
    funding_mode: input.funding_mode ?? 'donation',
    status: input.status ?? 'open',
    like_count: 0,
    pledged_native_token: '0',
    doc_path: input.doc_path ?? null,
    queued_at: input.status === 'queued' ? new Date().toISOString() : null,
    completed_at: input.status === 'completed' ? new Date().toISOString() : null,
    on_chain: null,
    signal_at_completion: null,
    builder_user_id: input.builder_user_id ?? null,
    payout_wallet_address: input.payout_wallet_address ?? null,
    payout_tx_hash: null,
    payout_at: null,
  }

  return upsertPool(cloneId, poolSlug, payload)
}

// Admin-only: patch selective pool fields. Does not allow full overwrite.
// TODO: use React19 + Next16 server actions for input validation at call-site where possible.
export async function updateAdminPublicPool(
  poolId: string,
  input: PublicPoolAdminUpdate,
): Promise<PublicPoolDoc> {
  const pool = await readPoolById(poolId)
  if (!pool) {
    throw new Error('Public pool not found')
  }

  const patch: Partial<PublicPool> = {}

  // Conditionally patch known updatable fields - skip if undefined
  if (input.title !== undefined) patch.title = input.title
  if (input.description !== undefined) patch.description = input.description
  if (input.pool_kind !== undefined) patch.pool_kind = input.pool_kind
  if (input.labels !== undefined) patch.labels = input.labels
  if (input.doc_path !== undefined) patch.doc_path = input.doc_path
  if (input.funding_mode !== undefined) patch.funding_mode = input.funding_mode
  if (input.builder_user_id !== undefined) patch.builder_user_id = input.builder_user_id
  if (input.payout_wallet_address !== undefined) {
    patch.payout_wallet_address = input.payout_wallet_address
  }

  // If goal hours updates, also recalculate goal ring
  if (input.goal_hours !== undefined) {
    patch.goal_hours = input.goal_hours
    patch.goal_native_token = goalRingFromHours(input.goal_hours)
  }

  // Handle status changes: update timestamps appropriately
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

  // If nothing to update, short-circuit with current pool doc
  if (Object.keys(patch).length === 0) {
    return pool
  }

  const updated = await updatePoolFields(poolId, patch)

  if (input.status === 'completed') {
    try {
      await maybePayoutBuilderOnComplete(updated)
    } catch {
      // logged inside updatePoolStatus path; keep admin update resilient
    }
    return (await readPoolById(poolId)) ?? updated
  }

  return updated
}

// Admin-only: remove a public pool by id
export async function deleteAdminPublicPool(poolId: string): Promise<void> {
  // TODO: add audit logging in future for destructive admin actions
  await deletePoolById(poolId)
}

// Fetches a public pool doc by its id (returns null if not found)
export async function getPublicPoolById(poolId: string): Promise<PublicPoolDoc | null> {
  return readPoolById(poolId)
}

// Expose contribution error type for caller-side error-handling
export { PublicPoolEscrowNotAvailableError }
