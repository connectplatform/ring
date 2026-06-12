/**
 * Settlement Service for Vendor Payouts
 * 
 * Manages automated vendor payouts, commission calculations,
 * multi-party payment splitting, and dispute escrow management.
 * 
 * NOTE: NO cache() - financial operations require real-time accuracy
 */

import { cache } from 'react'
import { db } from '@/lib/database'
import { Order, VendorOrder } from '@/features/store/types'
import { 
  VendorProfile,
  MerchantConfiguration,
  SettlementRules
} from '@/features/store/types/vendor'
import { 
  DEFAULT_COMMISSION_PCT,
  SettlementFrequency,
  StoreEvent,
  TIER_BENEFITS
} from '@/constants/store'
import { publishEvent } from '@/lib/events/event-bus.server'
import {
  computeWeightedReferralCommissionFromOrderItems,
  normalizeProductReferralInput,
  type ReferralCommissionProductInput,
  type ReferralItemRate,
} from '@/features/store/lib/referral-commission'
import { STORE_COLLECTIONS } from '@/features/store/constants/collections'

function vendorProfileId(vendorId: string): string {
  const entityId = vendorId.replace(/^vendor_/, '')
  return `vendor_${entityId}`
}

function settlementCurrency(order: Order): string {
  if (order.totals.RING) return 'RING'
  if (order.totals.DAARION) return 'DAARION'
  if (order.totals.DAAR) return 'DAAR'
  return 'UAH'
}

// Settlement record for tracking payouts
export interface Settlement {
  id: string
  vendorId: string
  orderId: string
  amount: number
  currency: string
  commission: number
  netPayout: number
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'held'
  scheduledFor: string
  processedAt?: string
  transactionId?: string
  failureReason?: string
  metadata?: Record<string, any>
}

// Payout batch for processing multiple settlements
export interface PayoutBatch {
  id: string
  settlements: string[] // Settlement IDs
  totalAmount: number
  currency: string
  status: 'created' | 'processing' | 'completed' | 'partial' | 'failed'
  createdAt: string
  processedAt?: string
  completedCount: number
  failedCount: number
}

// Commission breakdown for transparency
export interface CommissionBreakdown {
  platformCommission: number
  referralCommission: number
  referralEffectivePercent?: number
  referralByItem?: ReferralItemRate[]
  customSplits: Array<{
    recipientId: string
    amount: number
    description: string
  }>
  totalCommission: number
}

async function loadProductsForOrderItems(
  items: VendorOrder['items'],
): Promise<Map<string, ReferralCommissionProductInput>> {
  const productsById = new Map<string, ReferralCommissionProductInput>()

  for (const item of items) {
    if (!item.productId || productsById.has(item.productId)) continue
    const result = await db().findDocById<Record<string, unknown>>(
      'store_products',
      item.productId
    )
    if (!result.success || !result.data) continue
    const raw = result.data as Record<string, unknown>
    const normalized = normalizeProductReferralInput(raw)
    if (normalized) {
      productsById.set(item.productId, normalized)
    }
  }

  return productsById
}

/**
 * Calculate commission for a vendor order
 */
export function calculateCommission(
  vendorOrder: VendorOrder,
  vendor: VendorProfile,
  merchantConfig?: MerchantConfiguration,
  productsById?: Map<string, ReferralCommissionProductInput>,
): CommissionBreakdown {
  const subtotal = vendorOrder.subtotal
  
  // Get tier-based commission rate
  const tierBenefits = TIER_BENEFITS[vendor.storeTier || 'starter']
  const baseCommissionRate = tierBenefits?.commissionRate || DEFAULT_COMMISSION_PCT
  
  // Calculate platform commission
  const platformCommission = (subtotal * baseCommissionRate) / 100
  
  // Per-item weighted referral commission when a referral code is present
  const referralResult = computeWeightedReferralCommissionFromOrderItems(
    vendorOrder.items,
    Boolean(vendorOrder.metadata?.referralCode),
    merchantConfig,
    productsById,
  )
  const referralCommission = referralResult.amount
  
  // Calculate custom splits if defined
  const customSplits: CommissionBreakdown['customSplits'] = []
  if (merchantConfig?.commissionStructure?.customSplits) {
    for (const split of merchantConfig.commissionStructure.customSplits) {
      customSplits.push({
        recipientId: split.recipientId,
        amount: (subtotal * split.percentage) / 100,
        description: split.description
      })
    }
  }
  
  const totalCustomSplits = customSplits.reduce((sum, split) => sum + split.amount, 0)
  const totalCommission = platformCommission + referralCommission + totalCustomSplits
  
  return {
    platformCommission,
    referralCommission,
    referralEffectivePercent: referralResult.effectivePercent,
    referralByItem: referralResult.itemRates,
    customSplits,
    totalCommission
  }
}

/**
 * Create settlement record for a vendor order
 */
export async function createSettlement(
  order: Order,
  vendorOrder: VendorOrder
): Promise<Settlement> {
  const profileId = vendorProfileId(vendorOrder.vendorId)
  const vendorResult = await db().findDocById<VendorProfile>(
    STORE_COLLECTIONS.vendorProfiles,
    profileId
  )
  if (!vendorResult.success || !vendorResult.data) {
    throw new Error(`Vendor not found: ${vendorOrder.vendorId}`)
  }
  const vendor = vendorResult.data as VendorProfile
  
  let merchantConfig: MerchantConfiguration | null = null
  if (vendor.storeMerchantConfigID) {
    const configResult = await db().findDocById<MerchantConfiguration>(
      STORE_COLLECTIONS.merchantConfigs,
      vendor.storeMerchantConfigID
    )
    if (configResult.success && configResult.data) {
      merchantConfig = configResult.data as MerchantConfiguration
    }
  }
  
  const productsById = await loadProductsForOrderItems(vendorOrder.items)

  // Calculate commission (per-item referral rates when referral code present)
  const commission = calculateCommission(vendorOrder, vendor, merchantConfig, productsById)
  
  // Calculate net payout
  const netPayout = vendorOrder.subtotal - commission.totalCommission
  
  // Determine settlement schedule based on rules
  const settlementRules = merchantConfig?.settlementRules
  const scheduledFor = calculateSettlementDate(
    settlementRules?.frequency || SettlementFrequency.WEEKLY,
    settlementRules?.holdPeriodDays || 3
  )
  
  const settlement: Settlement = {
    id: `settlement_${Date.now()}_${vendorOrder.vendorId}`,
    vendorId: vendorOrder.vendorId,
    orderId: order.id,
    amount: vendorOrder.subtotal,
    currency: settlementCurrency(order),
    commission: commission.totalCommission,
    netPayout,
    status: 'pending',
    scheduledFor,
    metadata: {
      commissionBreakdown: commission,
      referralCommission: commission.referralCommission,
      referralEffectivePercent: commission.referralEffectivePercent,
      vendorStoreId: vendorOrder.storeId,
      orderItems: vendorOrder.items.length
    }
  }
  
  await db().createDoc(STORE_COLLECTIONS.settlements, settlement, { id: settlement.id })
  
  return settlement
}

/**
 * Calculate settlement date based on frequency and hold period
 */
function calculateSettlementDate(
  frequency: SettlementFrequency,
  holdPeriodDays: number
): string {
  const now = new Date()
  const holdDate = new Date(now.getTime() + holdPeriodDays * 24 * 60 * 60 * 1000)
  
  switch (frequency) {
    case SettlementFrequency.INSTANT:
      return holdDate.toISOString()
      
    case SettlementFrequency.DAILY:
      // Next day after hold period
      holdDate.setDate(holdDate.getDate() + 1)
      holdDate.setHours(0, 0, 0, 0)
      return holdDate.toISOString()
      
    case SettlementFrequency.WEEKLY:
      // Next Monday after hold period
      const daysUntilMonday = (8 - holdDate.getDay()) % 7 || 7
      holdDate.setDate(holdDate.getDate() + daysUntilMonday)
      holdDate.setHours(0, 0, 0, 0)
      return holdDate.toISOString()
      
    case SettlementFrequency.MONTHLY:
      // First day of next month after hold period
      holdDate.setMonth(holdDate.getMonth() + 1, 1)
      holdDate.setHours(0, 0, 0, 0)
      return holdDate.toISOString()
      
    default:
      return holdDate.toISOString()
  }
}

/**
 * Process due settlements for payout
 */
export async function processDueSettlements(): Promise<PayoutBatch> {
  const now = new Date().toISOString()

  const result = await db().queryDocs({
    collection: STORE_COLLECTIONS.settlements,
    filters: [
      { field: 'status', operator: '=', value: 'pending' },
      { field: 'scheduledFor', operator: '<=', value: now }
    ],
    pagination: { limit: 100 }
  })
  
  if (!result.success || !result.data) {
    return null
  }
  
  const dueSettlements = result.data as unknown as Settlement[]
  
  if (dueSettlements.length === 0) {
    return null
  }
  
  // Create payout batch
  const batch: PayoutBatch = {
    id: `batch_${Date.now()}`,
    settlements: dueSettlements.map(s => s.id),
    totalAmount: dueSettlements.reduce((sum, s) => sum + s.netPayout, 0),
    currency: dueSettlements[0].currency,
    status: 'created',
    createdAt: now,
    completedCount: 0,
    failedCount: 0
  }
  
  await db().createDoc(STORE_COLLECTIONS.payoutBatches, batch, { id: batch.id })
  
  // Process each settlement
  for (const settlement of dueSettlements) {
    try {
      await processSettlement(settlement, batch.id)
      batch.completedCount++
    } catch (error) {
      console.error(`Failed to process settlement ${settlement.id}:`, error)
      batch.failedCount++
      
      // Mark settlement as failed
      await db().updateDoc(STORE_COLLECTIONS.settlements, settlement.id, {
        status: 'failed',
        failureReason: error.message
      })
    }
  }
  
  // Update batch status
  const batchStatus = batch.failedCount === 0 ? 'completed' : 
                      batch.completedCount === 0 ? 'failed' : 'partial'
  
  const processedAt = new Date().toISOString()
  await db().updateDoc(STORE_COLLECTIONS.payoutBatches, batch.id, {
    status: batchStatus,
    processedAt,
    completedCount: batch.completedCount,
    failedCount: batch.failedCount
  })

  return {
    ...batch,
    status: batchStatus,
    processedAt,
  }
}

/**
 * Process individual settlement
 */
async function processSettlement(
  settlement: Settlement,
  batchId: string
): Promise<void> {
  await db().updateDoc(STORE_COLLECTIONS.settlements, settlement.id, {
    status: 'processing'
  })
  
  try {
    // Get vendor's merchant configuration
    const vendorResult = await db().findDocById<VendorProfile>(
      STORE_COLLECTIONS.vendorProfiles,
      vendorProfileId(settlement.vendorId)
    )
    if (!vendorResult.success || !vendorResult.data) {
      throw new Error('Vendor not found')
    }
    const vendor = vendorResult.data as VendorProfile
    
    let merchantConfig: MerchantConfiguration | null = null
    if (vendor.storeMerchantConfigID) {
      const configResult = await db().findDocById<MerchantConfiguration>(
        STORE_COLLECTIONS.merchantConfigs,
        vendor.storeMerchantConfigID
      )
      if (configResult.success && configResult.data) {
        merchantConfig = configResult.data as MerchantConfiguration
      }
    }
    
    if (!merchantConfig || !merchantConfig.walletId) {
      throw new Error('Merchant configuration or wallet not found')
    }
    
    // Process payout based on configured mode and currency
    const payoutMode = getSettlementPayoutMode()
    let transactionId: string

    if (payoutMode === 'onchain') {
      transactionId = await processOnchainPayout(
        settlement.currency,
        merchantConfig.walletId,
        settlement.netPayout
      )
    } else if (settlement.currency === 'RING') {
      transactionId = await processRingPayout(
        merchantConfig.walletId,
        settlement.netPayout
      )
    } else {
      transactionId = await processCryptoPayout(
        settlement.currency,
        merchantConfig.walletId,
        settlement.netPayout
      )
    }
    
    // Update settlement as completed
    await db().updateDoc(STORE_COLLECTIONS.settlements, settlement.id, {
      status: 'completed',
      processedAt: new Date().toISOString(),
      transactionId,
      metadata: {
        ...settlement.metadata,
        batchId,
        payoutMode,
        simulated: payoutMode !== 'onchain',
      }
    })
    
    // Publish payout event
    await publishEvent({
      type: StoreEvent.PAYOUT_INITIATED,
      payload: {
        settlementId: settlement.id,
        vendorId: settlement.vendorId,
        amount: settlement.netPayout,
        currency: settlement.currency,
        transactionId
      }
    })
    
  } catch (error) {
    // Re-throw to be caught by caller
    throw error
  }
}

export type SettlementPayoutMode = 'simulated' | 'onchain'

/**
 * Payout rail selector. Defaults to `simulated` — settlements complete with a
 * `sim_` transaction id and `metadata.simulated: true` so UIs can badge them.
 * Set SETTLEMENT_PAYOUT_MODE=onchain only after the payout token, treasury
 * wallet, and SETTLEMENT_PAYOUT_* env are production-verified.
 */
export function getSettlementPayoutMode(): SettlementPayoutMode {
  return process.env.SETTLEMENT_PAYOUT_MODE === 'onchain' ? 'onchain' : 'simulated'
}

/**
 * On-chain ERC20 payout via the server treasury wallet (viem), mirroring the
 * refcodes reward-minter pattern. Requires:
 * - SETTLEMENT_PAYOUT_PRIVATE_KEY  (treasury wallet holding the payout token)
 * - SETTLEMENT_PAYOUT_TOKEN_ADDRESS (ERC20 used for vendor payouts)
 * - POLYGON_RPC_URL
 */
async function processOnchainPayout(
  currency: string,
  walletAddress: string,
  amount: number
): Promise<string> {
  const key = process.env.SETTLEMENT_PAYOUT_PRIVATE_KEY
  const token = process.env.SETTLEMENT_PAYOUT_TOKEN_ADDRESS
  if (!key || !token) {
    throw new Error(
      'SETTLEMENT_PAYOUT_MODE=onchain requires SETTLEMENT_PAYOUT_PRIVATE_KEY and SETTLEMENT_PAYOUT_TOKEN_ADDRESS'
    )
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    throw new Error(`Vendor payout wallet is not a valid address: ${walletAddress}`)
  }

  const { createWalletClient, createPublicClient, http, parseUnits, erc20Abi } = await import('viem')
  const { privateKeyToAccount } = await import('viem/accounts')
  const { polygon } = await import('viem/chains')

  const normalized = key.startsWith('0x') ? key : `0x${key}`
  const account = privateKeyToAccount(normalized as `0x${string}`)
  const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'
  const walletClient = createWalletClient({ account, chain: polygon, transport: http(rpcUrl) })
  const publicClient = createPublicClient({ chain: polygon, transport: http(rpcUrl) })

  const { request } = await publicClient.simulateContract({
    address: token as `0x${string}`,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [walletAddress as `0x${string}`, parseUnits(amount.toFixed(6), 18)],
    account,
  })
  const hash = await walletClient.writeContract(request)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') {
    throw new Error(`Payout transaction reverted: ${hash}`)
  }

  console.log(`On-chain payout: ${amount} ${currency} → ${walletAddress} (${hash})`)
  return hash
}

/**
 * Simulated RING payout (SETTLEMENT_PAYOUT_MODE=simulated).
 */
async function processRingPayout(
  walletId: string,
  amount: number
): Promise<string> {
  const transactionId = `sim_ring_${Date.now()}`
  console.log(`[SIMULATED] RING payout: ${amount} RING to wallet ${walletId}`)
  return transactionId
}

/**
 * Simulated payout for other currencies (SETTLEMENT_PAYOUT_MODE=simulated).
 */
async function processCryptoPayout(
  currency: string,
  walletId: string,
  amount: number
): Promise<string> {
  const transactionId = `sim_${currency.toLowerCase()}_${Date.now()}`
  console.log(`[SIMULATED] ${currency} payout: ${amount} to wallet ${walletId}`)
  return transactionId
}

/**
 * Hold settlement for dispute or review
 */
export async function holdSettlement(
  settlementId: string,
  reason: string
): Promise<void> {
  await db().updateDoc(STORE_COLLECTIONS.settlements, settlementId, {
    status: 'held',
    metadata: {
      holdReason: reason,
      heldAt: new Date().toISOString()
    }
  })
}

/**
 * Release held settlement
 */
export async function releaseHeldSettlement(
  settlementId: string
): Promise<void> {
  const settlementResult = await db().findDocById<Settlement>(
    STORE_COLLECTIONS.settlements,
    settlementId
  )
  if (!settlementResult.success || !settlementResult.data) {
    throw new Error('Settlement not found or not held')
  }
  
  const settlement = settlementResult.data as Settlement
  if (settlement.status !== 'held') {
    throw new Error('Settlement not held')
  }
  
  // Reschedule for next payout cycle
  const newScheduledDate = calculateSettlementDate(
    SettlementFrequency.DAILY,
    0 // No additional hold period
  )
  
  await db().updateDoc(STORE_COLLECTIONS.settlements, settlementId, {
    status: 'pending',
    scheduledFor: newScheduledDate,
    metadata: {
      ...settlement.metadata,
      releasedAt: new Date().toISOString()
    }
  })
}

/**
 * Get vendor payout history
 * Cached for performance
 */
export const getVendorPayoutHistory = cache(async (
  vendorId: string,
  limit: number = 50
): Promise<Settlement[]> => {
  const result = await db().queryDocs({
    collection: STORE_COLLECTIONS.settlements,
    filters: [
      { field: 'vendorId', operator: '=', value: vendorId },
      { field: 'status', operator: '=', value: 'completed' }
    ],
    orderBy: [{ field: 'processedAt', direction: 'desc' }],
    pagination: { limit }
  })
  
  if (!result.success || !result.data) {
    return []
  }
  
  return result.data as unknown as Settlement[]
})

/**
 * Get vendor pending payouts
 * Cached for performance
 */
export const getVendorPendingPayouts = cache(async (
  vendorId: string
): Promise<{ settlements: Settlement[], total: number }> => {
  const result = await db().queryDocs({
    collection: STORE_COLLECTIONS.settlements,
    filters: [
      { field: 'vendorId', operator: '=', value: vendorId },
      { field: 'status', operator: '=', value: 'pending' }
    ],
    orderBy: [{ field: 'scheduledFor', direction: 'asc' }]
  })
  
  if (!result.success || !result.data) {
    return { settlements: [], total: 0 }
  }
  
  const settlements = result.data as unknown as Settlement[]
  
  const total = settlements.reduce((sum, s) => sum + s.netPayout, 0)
  
  return {
    settlements,
    total
  }
})

/**
 * Calculate platform revenue from commissions
 * Cached for performance
 */
export const calculatePlatformRevenue = cache(async (
  startDate: string,
  endDate: string
): Promise<{ total: number, breakdown: Record<string, number> }> => {
  const result = await db().queryDocs({
    collection: STORE_COLLECTIONS.settlements,
    filters: [
      { field: 'status', operator: '=', value: 'completed' },
      { field: 'processedAt', operator: '>=', value: startDate },
      { field: 'processedAt', operator: '<=', value: endDate }
    ]
  })
  
  if (!result.success || !result.data) {
    return { total: 0, breakdown: {} }
  }
  
  const settlements = result.data as unknown as Settlement[]
  
  const breakdown: Record<string, number> = {}
  let total = 0
  
  for (const settlement of settlements) {
    const commission = settlement.commission
    total += commission
    
    // Group by currency
    if (!breakdown[settlement.currency]) {
      breakdown[settlement.currency] = 0
    }
    breakdown[settlement.currency] += commission
  }
  
  return { total, breakdown }
})
