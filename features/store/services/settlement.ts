/**
 * Settlement Service for Vendor Payouts
 * 
 * Manages automated vendor payouts, commission calculations,
 * multi-party payment splitting, and dispute escrow management.
 */

import { 
  getCachedDocumentTyped,
  updateDocumentTyped,
  createDocumentTyped,
  runTransaction,
  getCachedCollectionTyped
} from '@/lib/services/firebase-service-manager'
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
  customSplits: Array<{
    recipientId: string
    amount: number
    description: string
  }>
  totalCommission: number
}

/**
 * Calculate commission for a vendor order
 */
export function calculateCommission(
  vendorOrder: VendorOrder,
  vendor: VendorProfile,
  merchantConfig?: MerchantConfiguration
): CommissionBreakdown {
  const subtotal = vendorOrder.subtotal
  
  // Get tier-based commission rate
  const tierBenefits = TIER_BENEFITS[vendor.storeTier || 'starter']
  const baseCommissionRate = tierBenefits?.commissionRate || DEFAULT_COMMISSION_PCT
  
  // Calculate platform commission
  const platformCommission = (subtotal * baseCommissionRate) / 100
  
  // Calculate referral commission if applicable
  let referralCommission = 0
  if (vendorOrder.metadata?.referralCode) {
    referralCommission = (subtotal * 5) / 100 // 5% referral commission
  }
  
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
  const vendor = await getCachedDocumentTyped<VendorProfile>(
    'vendorProfiles',
    `vendor_${vendorOrder.vendorId}`
  )
  
  if (!vendor) {
    throw new Error(`Vendor not found: ${vendorOrder.vendorId}`)
  }
  
  const merchantConfig = await getCachedDocumentTyped<MerchantConfiguration>(
    'merchantConfigs',
    vendor.storeMerchantConfigID || ''
  )
  
  // Calculate commission
  const commission = calculateCommission(vendorOrder, vendor, merchantConfig)
  
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
    currency: order.totals.RING ? 'RING' : 'DAAR', // Determine currency
    commission: commission.totalCommission,
    netPayout,
    status: 'pending',
    scheduledFor,
    metadata: {
      commissionBreakdown: commission,
      vendorStoreId: vendorOrder.storeId,
      orderItems: vendorOrder.items.length
    }
  }
  
  await createDocumentTyped('settlements', settlement.id, settlement)
  
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
  
  // Get all pending settlements that are due
  const dueSettlements = await getCachedCollectionTyped<Settlement>(
    'settlements',
    {
      filters: [
        { field: 'status', operator: '==', value: 'pending' },
        { field: 'scheduledFor', operator: '<=', value: now }
      ],
      limit: 100 // Process in batches
    }
  )
  
  if (dueSettlements.items.length === 0) {
    return null
  }
  
  // Create payout batch
  const batch: PayoutBatch = {
    id: `batch_${Date.now()}`,
    settlements: dueSettlements.items.map(s => s.id),
    totalAmount: dueSettlements.items.reduce((sum, s) => sum + s.netPayout, 0),
    currency: dueSettlements.items[0].currency, // Assume same currency for now
    status: 'created',
    createdAt: now,
    completedCount: 0,
    failedCount: 0
  }
  
  await createDocumentTyped('payoutBatches', batch.id, batch)
  
  // Process each settlement
  for (const settlement of dueSettlements.items) {
    try {
      await processSettlement(settlement, batch.id)
      batch.completedCount++
    } catch (error) {
      console.error(`Failed to process settlement ${settlement.id}:`, error)
      batch.failedCount++
      
      // Mark settlement as failed
      await updateDocumentTyped('settlements', settlement.id, {
        status: 'failed',
        failureReason: error.message
      })
    }
  }
  
  // Update batch status
  const batchStatus = batch.failedCount === 0 ? 'completed' : 
                      batch.completedCount === 0 ? 'failed' : 'partial'
  
  await updateDocumentTyped('payoutBatches', batch.id, {
    status: batchStatus,
    processedAt: new Date().toISOString(),
    completedCount: batch.completedCount,
    failedCount: batch.failedCount
  })
  
  return batch
}

/**
 * Process individual settlement
 */
async function processSettlement(
  settlement: Settlement,
  batchId: string
): Promise<void> {
  // Update settlement status to processing
  await updateDocumentTyped('settlements', settlement.id, {
    status: 'processing'
  })
  
  try {
    // Get vendor's merchant configuration
    const vendor = await getCachedDocumentTyped<VendorProfile>(
      'vendorProfiles',
      `vendor_${settlement.vendorId}`
    )
    
    const merchantConfig = await getCachedDocumentTyped<MerchantConfiguration>(
      'merchantConfigs',
      vendor?.storeMerchantConfigID || ''
    )
    
    if (!merchantConfig || !merchantConfig.walletId) {
      throw new Error('Merchant configuration or wallet not found')
    }
    
    // Process payout based on currency
    let transactionId: string
    
    if (settlement.currency === 'RING') {
      // Process RING token payout
      transactionId = await processRingPayout(
        merchantConfig.walletId,
        settlement.netPayout
      )
    } else {
      // Process other crypto payouts (DAAR, DAARION)
      transactionId = await processCryptoPayout(
        settlement.currency,
        merchantConfig.walletId,
        settlement.netPayout
      )
    }
    
    // Update settlement as completed
    await updateDocumentTyped('settlements', settlement.id, {
      status: 'completed',
      processedAt: new Date().toISOString(),
      transactionId,
      metadata: {
        ...settlement.metadata,
        batchId
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

/**
 * Process RING token payout
 */
async function processRingPayout(
  walletId: string,
  amount: number
): Promise<string> {
  // Integration with RING token smart contract
  // This would call the actual blockchain transaction
  
  // For now, simulate the payout
  const transactionId = `ring_tx_${Date.now()}`
  
  // In production, this would:
  // 1. Get wallet address from walletId
  // 2. Call smart contract transfer function
  // 3. Wait for transaction confirmation
  // 4. Return transaction hash
  
  console.log(`Processing RING payout: ${amount} RING to wallet ${walletId}`)
  
  return transactionId
}

/**
 * Process other crypto payouts (DAAR, DAARION)
 */
async function processCryptoPayout(
  currency: string,
  walletId: string,
  amount: number
): Promise<string> {
  // Integration with respective blockchain
  const transactionId = `${currency.toLowerCase()}_tx_${Date.now()}`
  
  console.log(`Processing ${currency} payout: ${amount} to wallet ${walletId}`)
  
  return transactionId
}

/**
 * Hold settlement for dispute or review
 */
export async function holdSettlement(
  settlementId: string,
  reason: string
): Promise<void> {
  await updateDocumentTyped('settlements', settlementId, {
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
  const settlement = await getCachedDocumentTyped<Settlement>('settlements', settlementId)
  
  if (!settlement || settlement.status !== 'held') {
    throw new Error('Settlement not found or not held')
  }
  
  // Reschedule for next payout cycle
  const newScheduledDate = calculateSettlementDate(
    SettlementFrequency.DAILY,
    0 // No additional hold period
  )
  
  await updateDocumentTyped('settlements', settlementId, {
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
 */
export async function getVendorPayoutHistory(
  vendorId: string,
  limit: number = 50
): Promise<Settlement[]> {
  const settlements = await getCachedCollectionTyped<Settlement>(
    'settlements',
    {
      filters: [
        { field: 'vendorId', operator: '==', value: vendorId },
        { field: 'status', operator: '==', value: 'completed' }
      ],
      orderBy: { field: 'processedAt', direction: 'desc' },
      limit
    }
  )
  
  return settlements.items
}

/**
 * Get vendor pending payouts
 */
export async function getVendorPendingPayouts(
  vendorId: string
): Promise<{ settlements: Settlement[], total: number }> {
  const settlements = await getCachedCollectionTyped<Settlement>(
    'settlements',
    {
      filters: [
        { field: 'vendorId', operator: '==', value: vendorId },
        { field: 'status', operator: '==', value: 'pending' }
      ],
      orderBy: { field: 'scheduledFor', direction: 'asc' }
    }
  )
  
  const total = settlements.items.reduce((sum, s) => sum + s.netPayout, 0)
  
  return {
    settlements: settlements.items,
    total
  }
}

/**
 * Calculate platform revenue from commissions
 */
export async function calculatePlatformRevenue(
  startDate: string,
  endDate: string
): Promise<{ total: number, breakdown: Record<string, number> }> {
  const settlements = await getCachedCollectionTyped<Settlement>(
    'settlements',
    {
      filters: [
        { field: 'status', operator: '==', value: 'completed' },
        { field: 'processedAt', operator: '>=', value: startDate },
        { field: 'processedAt', operator: '<=', value: endDate }
      ]
    }
  )
  
  const breakdown: Record<string, number> = {}
  let total = 0
  
  for (const settlement of settlements.items) {
    const commission = settlement.commission
    total += commission
    
    // Group by currency
    if (!breakdown[settlement.currency]) {
      breakdown[settlement.currency] = 0
    }
    breakdown[settlement.currency] += commission
  }
  
  return { total, breakdown }
}
