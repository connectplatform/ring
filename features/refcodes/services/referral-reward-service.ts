import 'server-only'

import { parseUnits } from 'viem'
import { db } from '@/lib/database'
import { logger } from '@/lib/logger'
import { priceOracleService } from '@/services/blockchain/price-oracle-service'
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

function orderTotalToUsd(total: number, currency: string): number {
  const cur = currency.toUpperCase()
  if (cur === 'USD' || cur === 'USDT' || cur === 'USDC') return total
  if (cur === 'UAH') return total / REFERRAL_UAH_PER_USD
  return total
}

async function loadMerchantConfigsForOrder(
  entityIds: string[],
): Promise<Map<string, MerchantConfiguration>> {
  const uniqueIds = [...new Set(entityIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const map = new Map<string, MerchantConfiguration>()

  for (const entityId of uniqueIds) {
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

async function computeRewardTokenAmount(
  orderTotal: number,
  currency: string,
  rewardPercent: number,
): Promise<{ amount: string; amountWei: string }> {
  const usdValue = orderTotalToUsd(orderTotal, currency) * (rewardPercent / 100)
  const conversion = await priceOracleService.convertUsdToRing(usdValue.toFixed(6))
  const amount = conversion.token_amount
  const amountWei = parseUnits(amount, 18).toString()
  return { amount, amountWei }
}

async function rewardExistsForOrder(orderReference: string): Promise<boolean> {
  const result = await db().queryDocs({
    collection: REFERRAL_REWARDS_COLLECTION,
    filters: [{ field: 'orderReference', operator: '=', value: orderReference }],
    pagination: { limit: 1 },
  })
  return Boolean(result.success && result.data.length)
}

function mapRewardRows(rows: Array<ReferralRewardRecord & { id: string }>) {
  return rows.map((row) => ({
    id: row.id,
    ...row,
  }))
}

export const ReferralRewardService = {
  async onOrderPaid(params: {
    order: StoreOrder & { referralCode?: string; referrerUserId?: string; referrerWallet?: string }
    orderReference: string
    rail: ReferralRewardRail
  }): Promise<{ created: boolean; rewardId?: string }> {
    const { order, orderReference, rail } = params

    if (!order.referrerWallet || !order.referrerUserId || !order.referralCode) {
      return { created: false }
    }

    if (await rewardExistsForOrder(orderReference)) {
      return { created: false }
    }

    const entityIds = (order.items || [])
      .map((item) => item.product?.ownerEntityId)
      .filter((id): id is string => Boolean(id))
    const merchantConfigByEntityId = await loadMerchantConfigsForOrder(entityIds)

    const productsById = await loadReferralProductInputs(
      (order.items || []).map((item) => item.product?.id).filter((id): id is string => Boolean(id)),
      { findById: (collection, id) => db().findDocById(collection, id) },
    )

    const rewardPercent = computeWeightedReferralPercentFromCart(
      order.items || [],
      merchantConfigByEntityId,
      undefined,
      productsById,
    )

    const { amount, amountWei } = await computeRewardTokenAmount(
      order.total,
      order.payment?.currency || 'UAH',
      rewardPercent,
    )
    const status: ReferralRewardStatus = rail === 'fiat' ? 'pending_approval' : 'approved'
    const now = new Date().toISOString()
    const rewardId = `refreward_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    const record: ReferralRewardRecord = {
      orderReference,
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

    const created = await db().createDoc(REFERRAL_REWARDS_COLLECTION, record, { id: rewardId })
    if (!created.success) {
      logger.error('Failed to create referral reward record', { orderReference })
      return { created: false }
    }

    if (status === 'approved') {
      await mintReferralReward(rewardId)
    }

    return { created: true, rewardId }
  },

  async onMembershipPaid(params: {
    userId: string
    orderReference: string
    amount: number
    currency: string
  }): Promise<{ created: boolean; rewardId?: string }> {
    const { userId, orderReference, amount, currency } = params

    if (await rewardExistsForOrder(orderReference)) {
      return { created: false }
    }

    const userResult = await db().readDoc<Record<string, unknown>>('users', userId)
    if (!userResult.success || !userResult.data) return { created: false }

    const referred = userResult.data.referredBy as {
      referralCode?: string
      referrerUserId?: string
      referrerWallet?: string
    } | undefined
    if (!referred?.referrerWallet || !referred.referrerUserId || !referred.referralCode) {
      return { created: false }
    }

    const rewardPercent = REFERRAL_REWARD_PERCENT
    const { amount: tokenAmount, amountWei } = await computeRewardTokenAmount(
      amount,
      currency,
      rewardPercent,
    )
    const status: ReferralRewardStatus = 'pending_approval'
    const now = new Date().toISOString()
    const rewardId = `refreward_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    const record: ReferralRewardRecord = {
      orderReference,
      orderId: orderReference,
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

  async approveReward(rewardId: string, adminUserId: string): Promise<{ success: boolean; error?: string }> {
    const read = await db().findDocById<ReferralRewardRecord>(REFERRAL_REWARDS_COLLECTION, rewardId)
    if (!read.success || !read.data) return { success: false, error: 'Not found' }

    const reward = read.data
    if (reward.status !== 'pending_approval') {
      return { success: false, error: 'Reward is not pending approval' }
    }

    await db().updateDoc(REFERRAL_REWARDS_COLLECTION, rewardId, {
      status: 'approved',
      approvedBy: adminUserId,
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    return mintReferralReward(rewardId)
  },

  async rejectReward(rewardId: string, adminUserId: string): Promise<{ success: boolean }> {
    await db().updateDoc(REFERRAL_REWARDS_COLLECTION, rewardId, {
      status: 'rejected',
      approvedBy: adminUserId,
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    return { success: true }
  },

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

  async listRecent(limit = 25): Promise<Array<ReferralRewardRecord & { id: string }>> {
    const result = await db().queryDocs<ReferralRewardRecord & { id: string }>({
      collection: REFERRAL_REWARDS_COLLECTION,
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      pagination: { limit },
    })

    if (!result.success) return []
    return mapRewardRows(result.data)
  },

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
    const [codesResult, rewardsResult] = await Promise.all([
      db().queryDocs({ collection: REFCODE_COLLECTION, pagination: { limit: 10_000 } }),
      db().queryDocs<ReferralRewardRecord & { id: string }>({
        collection: REFERRAL_REWARDS_COLLECTION,
        pagination: { limit: 10_000 },
      }),
    ])

    const codeRows = codesResult.success ? codesResult.data : []
    const rewardRows = rewardsResult.success ? rewardsResult.data : []

    const { aggregateVisitStats } = await import('@/features/refcodes/lib/visit-analytics')
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
