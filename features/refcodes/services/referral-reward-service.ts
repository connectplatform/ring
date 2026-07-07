import 'server-only' // Ensures this code is only executed on the server side

import { parseUnits } from 'viem'
import { db } from '@/lib/database' // Custom DB abstraction; assumed to be async
import { logger } from '@/lib/logger'
import { nativeTokenPriceOracleService } from '@/services/blockchain/price-oracle-service'
import {
  REFERRAL_CHAIN_ID,
  REFCODE_COLLECTION,
  REFERRAL_REWARDS_COLLECTION,
  REFERRAL_REWARD_PERCENT,
  REFERRAL_UAH_PER_USD,
} from '@/features/refcodes/constants'
import {
  computeWeightedReferralPercentFromCart,
  loadReferralProductInputs,
} from '@/features/store/lib/referral-commission'
import type { MerchantConfiguration } from '@/features/store/types/vendor'
import type { ReferralRewardRail, ReferralRewardRecord, ReferralRewardStatus } from '@/features/refcodes/types'
import { REFERRAL_REWARD_TOKEN_ADDRESS } from '@/constants/web3'
import { mintReferralReward } from '@/features/refcodes/services/reward-minter'
import type { StoreOrder } from '@/features/store/types'
import { STORE_COLLECTIONS } from '@/features/store/constants/collections'
import { getNativeTokenDecimals } from '@/lib/ring-config-chain'

/**
 * Converts an order total to USD based on the given currency.
 * @param total Amount in original currency
 * @param currency Currency code (e.g., USD, UAH)
 * @returns Equivalent amount in USD
 */
function orderTotalToUsd(total: number, currency: string): number {
  const cur = currency.toUpperCase()
  // If already in USD-pegged or dollar-stable currency, no conversion needed
  if (cur === 'USD' || cur === 'USDT' || cur === 'USDC') return total
  if (cur === 'UAH') return total / REFERRAL_UAH_PER_USD // Convert UAH to USD
  return total // Fallback: just return original total (may not be correct for all currencies)
}

/**
 * Loads and returns a map of merchant config for a list of entityIds.
 * Results are returned as Map<EntityId, MerchantConfiguration>
 */
async function loadMerchantConfigsForOrder(
  entityIds: string[],
): Promise<Map<string, MerchantConfiguration>> {
  // Filter entityIds array to contain unique non-empty IDs only
  const uniqueIds = [...new Set(entityIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const map = new Map<string, MerchantConfiguration>()

  for (const entityId of uniqueIds) {
    // Query DB for merchant config for a given entityId (limit 1 result per)
    const result = await db().queryDocs<MerchantConfiguration & { id: string }>({
      collection: STORE_COLLECTIONS.merchantConfigs,
      filters: [{ field: 'ownerEntityId', operator: '=', value: entityId }],
      pagination: { limit: 1 },
    })
    if (!result.success || result.data.length === 0) continue
    map.set(entityId, result.data[0] as MerchantConfiguration)
  }
  return map
}

// TODO: Consider deprecating this if referral rewards switch to internal points only.
/**
 * Computes the referral reward value in tokens and Wei for an order,
 * based on USD value and the reward percent.
 * @returns Amount (human-readable) and amountWei (on-chain, stringified)
 */
async function computeRewardTokenAmount(
  orderTotal: number,
  currency: string,
  rewardPercent: number,
): Promise<{ amount: string; amountWei: string }> {
  // Convert order total to USD, then apply referral percentage
  const usdValue = orderTotalToUsd(orderTotal, currency) * (rewardPercent / 100);

  // Get token decimals; may be async/variable per network
  const decimals = getNativeTokenDecimals();

  // Query price oracle to get how much native token is equivalent to usdValue
  // Price oracle may return string or number, handle both cases
  const conversion = await nativeTokenPriceOracleService.convertUsdToNativeToken(
    usdValue.toString(),
  );

  // Do not round or reduce precision before on-chain conversion
  const amount = typeof conversion.token_amount === 'number'
    ? conversion.token_amount.toString()
    : conversion.token_amount;

  // Convert raw token amount to Wei units (BigInt as string)
  const amountWei = parseUnits(amount, decimals).toString();

  return { amount, amountWei };
}

/**
 * Checks whether a referral reward already exists for a given order reference.
 * @returns Boolean indicating existence
 */
async function rewardExistsForOrder(orderReference: string): Promise<boolean> {
  const result = await db().queryDocs({
    collection: REFERRAL_REWARDS_COLLECTION,
    filters: [{ field: 'orderReference', operator: '=', value: orderReference }],
    pagination: { limit: 1 },
  })
  return Boolean(result.success && result.data.length)
}

/**
 * Maps DB rows into an array of properly typed reward objects with IDs.
 * @param rows Array of reward records from DB
 */
function mapRewardRows(rows: Array<ReferralRewardRecord & { id: string }>) {
  return rows.map((row) => ({
    id: row.id,
    ...row,
  }))
}

/**
 * Service for handling referral reward lifecycle:
 * creation, status updates, stats aggregation, and listing.
 */
export const ReferralRewardService = {
  /**
   * Called when an order is marked paid. Creates referral reward if order qualifies.
   * - Requires referrerWallet, referrerUserId, referralCode on the order
   * - Idempotent - does nothing if a reward record already exists for this order
   * - Handles reward payout via rail ('fiat' is two-stage, other rails approval is implied)
   */
  async onOrderPaid(params: {
    order: StoreOrder & { referralCode?: string; referrerUserId?: string; referrerWallet?: string }
    orderReference: string
    rail: ReferralRewardRail
  }): Promise<{ created: boolean; rewardId?: string }> {
    const { order, orderReference, rail } = params

    // Require referral context for reward
    if (!order.referrerWallet || !order.referrerUserId || !order.referralCode) {
      return { created: false }
    }

    // Check for duplicate; do not create multiple rewards for one order
    if (await rewardExistsForOrder(orderReference)) {
      return { created: false }
    }

    // Collect all unique merchant entityIds from the order items
    const entityIds = (order.items || [])
      .map((item) => item.product?.ownerEntityId)
      .filter((id): id is string => Boolean(id))

    // Load all merchant configs used in this order, by entityId
    const merchantConfigByEntityId = await loadMerchantConfigsForOrder(entityIds)

    // Load all referral-product-related configs from the cart
    const productsById = await loadReferralProductInputs(
      (order.items || []).map((item) => item.product?.id).filter((id): id is string => Boolean(id)),
      { findById: (collection, id) => db().findDocById(collection, id) },
    )

    // Compute reward percent using merchant config and possibly product-based overrides
    const rewardPercent = computeWeightedReferralPercentFromCart(
      order.items || [],
      merchantConfigByEntityId,
      undefined,
      productsById,
    )

    // Calculate the reward (token/Wei) for this order and percent
    const { amount, amountWei } = await computeRewardTokenAmount(
      order.total,
      order.payment?.currency || 'UAH',
      rewardPercent,
    )

    // rail: if 'fiat' → pending_approval, otherwise use 'approved'
    const status: ReferralRewardStatus = rail === 'fiat' ? 'pending_approval' : 'approved'
    const now = new Date().toISOString()
    // TODO: Replace rewardId logic with a collision-resistant UUID or nanoid
    const rewardId = `refreward_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    const record: ReferralRewardRecord = {
      orderReference, // For idempotency/reference back to originating order
      orderId: order.id,
      refCode: order.referralCode,
      referrerUserId: order.referrerUserId,
      referrerWallet: order.referrerWallet,
      refereeUserId: order.userId,
      orderTotal: order.total,
      currency: order.payment?.currency || 'UAH',
      rewardToken: REFERRAL_REWARD_TOKEN_ADDRESS,
      rewardAmount: amount,
      rewardAmountWei: amountWei,
      rewardPercent,
      chainId: REFERRAL_CHAIN_ID,
      rail,
      status,
      createdAt: now,
    }

    // Write the reward record to the database with generated rewardId as primary key
    const created = await db().createDoc(REFERRAL_REWARDS_COLLECTION, record, { id: rewardId })
    if (!created.success) {
      // Log error but do not throw - surface as unsuccessful creation
      logger.error('Failed to create referral reward record', { orderReference })
      return { created: false }
    }

    // If reward immediately requires minting (non-fiat), kick off minting logic
    if (status === 'approved') {
      await mintReferralReward(rewardId)
    }

    return { created: true, rewardId }
  },

  /**
   * Handles referral reward creation for membership payments (not store orders).
   * - Checks idempotency via orderReference
   * - Looks up referral information from user record
   */
  async onMembershipPaid(params: {
    userId: string
    orderReference: string
    amount: number
    currency: string
  }): Promise<{ created: boolean; rewardId?: string }> {
    const { userId, orderReference, amount, currency } = params

    // Short-circuit if a reward for this membership payment already exists
    if (await rewardExistsForOrder(orderReference)) {
      return { created: false }
    }

    // STUB: User lookup; assumes db().readDoc returns user record with referredBy
    const userResult = await db().readDoc<Record<string, unknown>>('users', userId)
    if (!userResult.success || !userResult.data) return { created: false }

    // Retrieve referral info from 'referredBy' property of user record
    const referred = userResult.data.referredBy as {
      referralCode?: string
      referrerUserId?: string
      referrerWallet?: string
    } | undefined
    if (!referred?.referrerWallet || !referred.referrerUserId || !referred.referralCode) {
      return { created: false }
    }

    const rewardPercent = REFERRAL_REWARD_PERCENT // Global/static percent for memberships

    // Calculate reward value based on paid amount and currency
    const { amount: tokenAmount, amountWei } = await computeRewardTokenAmount(
      amount,
      currency,
      rewardPercent,
    )

    // Always 'pending_approval' for fiat rails
    const status: ReferralRewardStatus = 'pending_approval'
    const now = new Date().toISOString()
    // TODO: Replace rewardId logic with nanoid or uuid
    const rewardId = `refreward_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    const record: ReferralRewardRecord = {
      orderReference,
      orderId: orderReference, // Here, using orderReference directly as ID for membership
      refCode: referred.referralCode,
      referrerUserId: referred.referrerUserId,
      referrerWallet: referred.referrerWallet,
      refereeUserId: userId,
      orderTotal: amount,
      currency,
      rewardToken: REFERRAL_REWARD_TOKEN_ADDRESS,
      rewardAmount: tokenAmount,
      rewardAmountWei: amountWei,
      rewardPercent,
      chainId: REFERRAL_CHAIN_ID,
      rail: 'fiat',
      status,
      createdAt: now,
    }

    const created = await db().createDoc(REFERRAL_REWARDS_COLLECTION, record, { id: rewardId })
    if (!created.success) {
      logger.error('Failed to create membership referral reward', { orderReference })
      return { created: false }
    }

    return { created: true, rewardId }
  },

  /**
   * Returns a list of all rewards with 'pending_approval' status, in reverse chronological order.
   * Limits results (default 50).
   */
  async listPendingApproval(limit = 50): Promise<Array<ReferralRewardRecord & { id: string }>> {
    const result = await db().queryDocs<ReferralRewardRecord & { id: string }>({
      collection: REFERRAL_REWARDS_COLLECTION,
      filters: [{ field: 'status', operator: '=', value: 'pending_approval' }],
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      pagination: { limit },
    })

    if (!result.success) return []
    return mapRewardRows(result.data)
  },

  /**
   * Lists the most recent rewards referring to a user by referrerUserId.
   * Limits to recent records (default 50).
   */
  async listForReferrer(referrerUserId: string, limit = 50): Promise<Array<ReferralRewardRecord & { id: string }>> {
    const result = await db().queryDocs<ReferralRewardRecord & { id: string }>({
      collection: REFERRAL_REWARDS_COLLECTION,
      filters: [{ field: 'referrerUserId', operator: '=', value: referrerUserId }],
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      pagination: { limit },
    })

    if (!result.success) return []
    return mapRewardRows(result.data)
  },

  /**
   * Approves a pending referral reward. Marks as 'approved', sets moderator info and mints it.
   * Returns error if reward not in 'pending_approval' state.
   */
  async approveReward(rewardId: string, adminUserId: string): Promise<{ success: boolean; error?: string }> {
    // Load the reward by its ID
    const read = await db().findDocById<ReferralRewardRecord>(REFERRAL_REWARDS_COLLECTION, rewardId)
    if (!read.success || !read.data) return { success: false, error: 'Not found' }

    const reward = read.data
    if (reward.status !== 'pending_approval') {
      return { success: false, error: 'Reward is not pending approval' }
    }

    // Update DB for approval and auditing
    await db().updateDoc(REFERRAL_REWARDS_COLLECTION, rewardId, {
      status: 'approved',
      approvedBy: adminUserId,
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    // Mint reward on-chain or reflect status
    return mintReferralReward(rewardId)
  },

  /**
   * Rejects a pending reward, marking it as 'rejected' and tagging with admin info.
   */
  async rejectReward(rewardId: string, adminUserId: string): Promise<{ success: boolean }> {
    await db().updateDoc(REFERRAL_REWARDS_COLLECTION, rewardId, {
      status: 'rejected',
      approvedBy: adminUserId,
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    return { success: true }
  },

  /**
   * Retrieves rewards matching a given status, for admin or filtering purposes.
   * @param status Any ReferralRewardStatus value
   * @param limit Max records to return
   */
  async listByStatus(
    status: ReferralRewardStatus,
    limit = 50
  ): Promise<Array<ReferralRewardRecord & { id: string }>> {
    const result = await db().queryDocs<ReferralRewardRecord & { id: string }>({
      collection: REFERRAL_REWARDS_COLLECTION,
      filters: [{ field: 'status', operator: '=', value: status }],
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      pagination: { limit },
    })

    if (!result.success) return []
    return mapRewardRows(result.data)
  },

  /**
   * Retrieves the most recently created rewards, regardless of status.
   * @param limit Number of results to return (default 25)
   */
  async listRecent(limit = 25): Promise<Array<ReferralRewardRecord & { id: string }>> {
    const result = await db().queryDocs<ReferralRewardRecord & { id: string }>({
      collection: REFERRAL_REWARDS_COLLECTION,
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      pagination: { limit },
    })

    if (!result.success) return []
    return mapRewardRows(result.data)
  },

  /**
   * Computes admin dashboard statistics for referral codes and rewards.
   * Includes reward counts by status, code usage, and visitation analytics.
   * @returns Summary statistics for reporting
   */
  async getAdminStats(): Promise<{
    totalCodes: number
    totalRewards: number
    pendingApproval: number
    approved: number
    minting: number
    minted: number
    failed: number
    rejected: number
    totalMintedTokens: number
    visitStats: {
      total: number
      today: number
      last7d: number
      last28d: number
    }
  }> {
    // NOTE: Arbitrary 10k limit - if >10k records exist, stats may be incomplete.
    // TODO: Switch to DB count/aggregation functions if possible for large data sets (native Next.js PG providers, React19 server actions RSC streaming with pagination)
    const [codesResult, rewardsResult] = await Promise.all([
      db().queryDocs({ collection: REFCODE_COLLECTION, pagination: { limit: 10_000 } }),
      db().queryDocs<ReferralRewardRecord & { id: string }>({
        collection: REFERRAL_REWARDS_COLLECTION,
        pagination: { limit: 10_000 },
      }),
    ])

    // Get array of code and reward rows, default to [] for non-success
    const codeRows = codesResult.success ? codesResult.data : []
    const rewardRows = rewardsResult.success ? rewardsResult.data : []

    // Dynamically import visit analytics (for dashboard separation/perf)
    const { aggregateVisitStats } = await import('@/features/refcodes/lib/visit-analytics')
    // Compute aggregate stats for code usage
    const visitStats = aggregateVisitStats(codeRows as Array<Record<string, unknown>>)

    const stats = {
      totalCodes: codeRows.length,
      totalRewards: rewardRows.length,
      pendingApproval: 0,
      approved: 0,
      minting: 0,
      minted: 0,
      failed: 0,
      rejected: 0,
      totalMintedTokens: 0,
      visitStats,
    }

    // Aggregate status counts and sum up minted reward amounts
    for (const reward of rewardRows) {
      switch (reward.status) {
        case 'pending_approval':
          stats.pendingApproval++
          break
        case 'approved':
          stats.approved++
          break
        case 'minting':
          stats.minting++
          break
        case 'minted':
          stats.minted++
          // Add total minted tokens; checks rewardAmount presence/parsability
          stats.totalMintedTokens += parseFloat(reward.rewardAmount || '0') || 0
          break
        case 'failed':
          stats.failed++
          break
        case 'rejected':
          stats.rejected++
          break
      }
    }

    return stats
  },
}

// TODO (React19/Next.js 16): 
// - Consider using @vercel/ai, React RSC Server Actions for some stats endpoints or streaming admin data
// - Switch from manual ID generation to nanoid or uuid
// - For very large data, implement DB-level aggregation instead of client-side for getAdminStats