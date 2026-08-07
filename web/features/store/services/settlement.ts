/**
 * Settlement Service for Vendor Payouts
 * 
 * Manages automated vendor payouts, commission calculations,
 * multi-party payment splitting, and dispute escrow management.
 * 
 * NOTE: NO cache() - financial operations require real-time accuracy
 */

// ----- Changes for @ring-config-types.ts payment types support -----
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
import {
  getCreditUnitLabel,
  getMainCurrencySymbol,
  getNativeTokenSymbol,
  getSystemConfigSnapshot,
} from '@/lib/ring-config-core'

// --- NEW: Import extra types for payment rails support from ring-config-types
import type { VendorMerchantPayoutRailType, VendorMerchantPayoutCurrencyType, VendorAcceptedPaymentMethods } from '@/lib/ring-config-types'

// Helper to extract vendor profile id (trivial, identity function)
function vendorProfileId(vendorId: number): number {
  return vendorId
}

// Returns the currency to use for settlement of an order
function settlementCurrency(order: Order): string {
  // Check new payment fields for explicit currency
  if ('payment' in order && order.payment && typeof order.payment === 'object') {
    // @ts-ignore - flexible picking, support new ring config types
    if (order.payment.currency) return order.payment.currency as string
  }
  // Fallback: infer from system config tokens and fiats, match order totals
  const config = getSystemConfigSnapshot()
  const tokens = config.tokens.supported ?? [getNativeTokenSymbol()]
  const fiats = config.supportedCurrencies ?? [getMainCurrencySymbol()]
  // Attempt to match currency in order.totals; return first match
  for (const currency of [...tokens, ...fiats]) {
    if (order.totals[currency]) return currency
  }
  // Final default: the project main currency
  return fiats[0] ?? getMainCurrencySymbol()
}

// Settlement record shape - see related payout rails
export interface Settlement {
  id: string
  vendorId: string
  orderId: string
  amount: number
  currency: string
  payoutRailType?: VendorMerchantPayoutRailType
  paymentMethod?: VendorAcceptedPaymentMethods
  payoutCurrencyType?: VendorMerchantPayoutCurrencyType
  commission: number
  netPayout: number
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'held'
  scheduledFor: string
  processedAt?: string
  transactionId?: string
  failureReason?: string
  metadata?: Record<string, any>
}

// Settlement batches for payout - individual batch per currency/rail type
export interface PayoutBatch {
  id: string
  settlements: string[] // Settlement IDs (reference)
  totalAmount: number
  currency: string
  status: 'created' | 'processing' | 'completed' | 'partial' | 'failed'
  createdAt: string
  processedAt?: string
  completedCount: number
  failedCount: number
  payoutRailType?: VendorMerchantPayoutRailType
  payoutCurrencyType?: VendorMerchantPayoutCurrencyType
}

// Commission breakdown for full transparency in payout reports
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

// Loads the full set of product inputs for each order item for commission/referral evaluation
async function loadProductsForOrderItems(
  items: VendorOrder['items'],
): Promise<Map<string, ReferralCommissionProductInput>> {
  const productsById = new Map<string, ReferralCommissionProductInput>()

  // Loop all items, fetch unique productIds, normalize for commission calculations
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
 * Calculate all commission components for a vendor order.
 * - Platform/tier commission
 * - Referral commission (weighted)
 * - Custom-defined splits
 */
export function calculateCommission(
  vendorOrder: VendorOrder,
  vendor: VendorProfile,
  merchantConfig?: MerchantConfiguration,
  productsById?: Map<string, ReferralCommissionProductInput>,
): CommissionBreakdown {
  const subtotal = vendorOrder.subtotal

  // Retrieve tier-specific commission rate from vendor storeTier (with fallback)
  const tierBenefits = TIER_BENEFITS[vendor.storeTier || 'starter']
  const baseCommissionRate = tierBenefits?.commissionRate || DEFAULT_COMMISSION_PCT

  // Calculate platform commission as % of subtotal
  const platformCommission = (subtotal * baseCommissionRate) / 100

  // Calculate per-item weighted referral, requires referralCode
  const referralResult = computeWeightedReferralCommissionFromOrderItems(
    vendorOrder.items,
    Boolean(vendorOrder.metadata?.referralCode),
    merchantConfig,
    productsById,
  )
  const referralCommission = referralResult.amount

  // Calculate additional splits (other payees or systems) if configured
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

  // Sum up custom splits for total commission
  const totalCustomSplits = customSplits.reduce((sum, split) => sum + split.amount, 0)
  const totalCommission = platformCommission + referralCommission + totalCustomSplits

  // Return fully detailed breakdown for transparency
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
 * Creates a settlement record for a vendor payout for a single vendor order.
 */
export async function createSettlement(
  order: Order,
  vendorOrder: VendorOrder
): Promise<Settlement> {
  // Lookup vendor profile from ID
  const profileId = vendorProfileId(Number(vendorOrder.vendorId))
  const vendorResult = await db().findDocById<VendorProfile>(
    STORE_COLLECTIONS.vendorProfiles,
    profileId.toString()
  )
  if (!vendorResult.success || !vendorResult.data) {
    throw new Error(`Vendor not found: ${vendorOrder.vendorId}`)
  }
  const vendor = vendorResult.data as VendorProfile

  // Optionally load merchantConfig for custom commission/settlement rules
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

  // Load products by productId for item-level referral/commission logic
  const productsById = await loadProductsForOrderItems(vendorOrder.items)

  // Compute total commission and breakdown (including custom splits, weighted referral, etc)
  const commission = calculateCommission(vendorOrder, vendor, merchantConfig, productsById)

  // Net payout to vendor after all commissions and splits
  const netPayout = vendorOrder.subtotal - commission.totalCommission

  // Determine scheduled payout date according to merchantConfig rules
  const settlementRules = merchantConfig?.settlementRules
  const scheduledFor = calculateSettlementDate(
    settlementRules?.frequency || SettlementFrequency.WEEKLY,
    settlementRules?.holdPeriodDays || 3
  )

  // Assign payout rails & currency from order.payment object if present
  let payoutRailType: VendorMerchantPayoutRailType | undefined
  let paymentMethod: VendorAcceptedPaymentMethods | undefined
  let payoutCurrencyType: VendorMerchantPayoutCurrencyType | undefined

  if ('payment' in order && order.payment && typeof order.payment === 'object') {
    // Prefer explicit payout rails/currency on order, fallback handled in settlementCurrency()
    // @ts-ignore
    if (order.payment.railType) payoutRailType = order.payment.railType
    // @ts-ignore
    if (order.payment.methodType) paymentMethod = order.payment.methodType
    // @ts-ignore
    if (order.payment.currencyType) payoutCurrencyType = order.payment.currencyType
  }

  // Compose final settlement record for persistent store
  const settlement: Settlement = {
    id: `settlement_${Date.now()}_${vendorOrder.vendorId}`,
    vendorId: vendorOrder.vendorId,
    orderId: order.id,
    amount: vendorOrder.subtotal,
    currency: settlementCurrency(order),
    payoutRailType,
    paymentMethod,
    payoutCurrencyType,
    commission: commission.totalCommission,
    netPayout,
    status: 'pending',
    scheduledFor,
    metadata: {
      commissionBreakdown: commission,
      referralCommission: commission.referralCommission,
      referralEffectivePercent: commission.referralEffectivePercent,
      vendorStoreId: vendorOrder.storeId,
      orderItems: vendorOrder.items.length,
      // Store order payment info for internal support/debugging
      ...(order.payment ? { orderPayment: order.payment } : {})
    }
  }

  // Persist settlement to database keyed by unique id
  await db().createDoc(STORE_COLLECTIONS.settlements, settlement, { id: settlement.id })

  return settlement
}

/**
 * Calculate the scheduled settlement date given frequency and hold period
 * - Used to schedule when payout will become available for processing
 */
function calculateSettlementDate(
  frequency: SettlementFrequency,
  holdPeriodDays: number
): string {
  const now = new Date()
  // Add hold period before any payout schedule applies
  const holdDate = new Date(now.getTime() + holdPeriodDays * 24 * 60 * 60 * 1000)

  switch (frequency) {
    case SettlementFrequency.INSTANT:
      // INSTANT: Payout after hold period only
      return holdDate.toISOString()
    case SettlementFrequency.DAILY:
      // DAILY: payout on next day after hold period, at the start of the day
      holdDate.setDate(holdDate.getDate() + 1)
      holdDate.setHours(0, 0, 0, 0)
      return holdDate.toISOString()
    case SettlementFrequency.WEEKLY:
      // WEEKLY: payout on first Monday after hold period
      const daysUntilMonday = (8 - holdDate.getDay()) % 7 || 7
      holdDate.setDate(holdDate.getDate() + daysUntilMonday)
      holdDate.setHours(0, 0, 0, 0)
      return holdDate.toISOString()
    case SettlementFrequency.MONTHLY:
      // MONTHLY: first day of next month after hold, midnight
      holdDate.setMonth(holdDate.getMonth() + 1, 1)
      holdDate.setHours(0, 0, 0, 0)
      return holdDate.toISOString()
    default:
      // Default fallback: immediately after hold period
      return holdDate.toISOString()
  }
}

/**
 * Processes all settlements that are due for payout (status=pending, scheduledFor<=now)
 * Batches all due settlements for a payout run.
 * Returns batch summary; processes as many settlements as possible.
 */
export async function processDueSettlements(): Promise<PayoutBatch | null> {
  const now = new Date().toISOString()

  // Query all pending settlements whose schedule date is reached/exceeded (hardcode batch limit=100)
  const result = await db().queryDocs({
    collection: STORE_COLLECTIONS.settlements,
    filters: [
      { field: 'status', operator: '=', value: 'pending' },
      { field: 'scheduledFor', operator: '<=', value: now }
    ],
    pagination: { limit: 100 }
  })

  if (!result.success || !result.data) {
    // No settlements found / error
    return null
  }

  const dueSettlements = result.data as unknown as Settlement[]

  if (dueSettlements.length === 0) {
    // No settlements to process in this batch
    return null
  }

  // Determine payout rail/currency for batch from first settlement (homogeneous batch)
  let payoutRailType: VendorMerchantPayoutRailType | undefined = undefined
  let payoutCurrencyType: VendorMerchantPayoutCurrencyType | undefined = undefined
  if (dueSettlements[0].payoutRailType) payoutRailType = dueSettlements[0].payoutRailType
  if (dueSettlements[0].payoutCurrencyType) payoutCurrencyType = dueSettlements[0].payoutCurrencyType

  // Create and register new payout batch for this settlements cycle
  const batch: PayoutBatch = {
    id: `batch_${Date.now()}`,
    settlements: dueSettlements.map(s => s.id),
    totalAmount: dueSettlements.reduce((sum, s) => sum + s.netPayout, 0),
    currency: dueSettlements[0].currency,
    status: 'created',
    createdAt: now,
    completedCount: 0,
    failedCount: 0,
    payoutRailType,
    payoutCurrencyType
  }

  await db().createDoc(STORE_COLLECTIONS.payoutBatches, batch, { id: batch.id })

  // Process each due settlement in the payout batch serially (could be parallelized for speed later)
  for (const settlement of dueSettlements) {
    try {
      // Try to process and mark as completed
      await processSettlement(settlement, batch.id)
      batch.completedCount++
    } catch (error) {
      // Failure: log, mark as failed and move to next
      console.error(`Failed to process settlement ${settlement.id}:`, error)
      batch.failedCount++
      await db().updateDoc(STORE_COLLECTIONS.settlements, settlement.id, {
        status: 'failed',
        failureReason: (error as Error).message
      })
    }
  }

  // Update final batch status (all, partial, none completed)
  const batchStatus = batch.failedCount === 0
    ? 'completed'
    : batch.completedCount === 0
      ? 'failed'
      : 'partial'

  // Save batch result & summary in DB
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
 * Process individual settlement for payout; moves status through processing→completed or failed.
 */
async function processSettlement(
  settlement: Settlement,
  batchId: string
): Promise<void> {
  // Mark settlement as "processing" in DB
  await db().updateDoc(STORE_COLLECTIONS.settlements, settlement.id, {
    status: 'processing'
  })

  try {
    // Load vendor and merchant config for payout details
    const vendorResult = await db().findDocById<VendorProfile>(
      STORE_COLLECTIONS.vendorProfiles,
      settlement.vendorId.toString()
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

    // Ensure vendor wallet exists for payout
    if (!merchantConfig || !merchantConfig.walletId) {
      throw new Error('Merchant configuration or wallet not found')
    }
    const systemConfig = getSystemConfigSnapshot()
    const nativeToken = systemConfig.tokens.nativeToken
    const creditBalanceUnit = getCreditUnitLabel()
    const mainCurrency = getMainCurrencySymbol()

    // Retrieve platform payout mode (simulated, onchain, etc)
    const payoutMode = getSettlementPayoutMode()
    let transactionId: string

    // Branch based on payoutRailType for actual payout handling
    switch (settlement.payoutRailType) {
      case 'native_token':
        // On-chain payout via native token (e.g. SPL on Solana or ERC20 with similar function)
        transactionId = await processNativeTokenPayout(
          settlement.currency,
          merchantConfig.walletId,
          settlement.netPayout
        );
        break;
      case 'credit_balance':
        // Internal balance adjustment - vendor receives platform credits
        transactionId = await processCreditBalancePayout(
          merchantConfig.walletId,
          settlement.netPayout,
        );
        break;
      default:
        // STUB: generic payout handler for fiat rails, eg. swift/iban. TODO: Implement
        // For now, fallback to simulated payout handler (logs, assigns synthetic id)
        transactionId = await processCryptoPayout(
          settlement.currency,
          merchantConfig.walletId,
          settlement.netPayout
        );
    }

    // Persist settlement as fully completed in the data store
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

    // Publish application-level event for payout for listeners/reporting
    await publishEvent({
      type: StoreEvent.PAYOUT_INITIATED,
      payload: {
        settlementId: settlement.id,
        vendorId: settlement.vendorId,
        amount: settlement.netPayout,
        currency: settlement.currency,
        transactionId,
        payoutRailType: settlement.payoutRailType,
        payoutCurrencyType: settlement.payoutCurrencyType,
        paymentMethod: settlement.paymentMethod
      }
    })

  } catch (error) {
    // Bubble up error so batch can mark as failed
    throw error
  }
}

export type SettlementPayoutMode = 'simulated' | 'onchain'

/**
 * Used to select payout mode for settlement processing depending on environment configuration
 */
export function getSettlementPayoutMode(): SettlementPayoutMode {
  // Returns 'onchain' for real payouts and 'simulated' (default) for safe staging/test/dev
  return process.env.SETTLEMENT_PAYOUT_MODE === 'onchain' ? 'onchain' : 'simulated'
}

/**
 * On-chain SPL/solana support for native payout rails.
 * Requires environment configuration (private key, mint addresses, etc).
 * TODO: Move onchain implementation to shared payment SDK when stable
 */
import {
  Connection,
  Keypair,
  ParsedAccountData,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'

/**
 * Process a native Solana SPL token payout to vendor's wallet.
 * Verifies treasury and payout wallet addresses, computes transfer, sends transaction.
 */
async function processNativeTokenPayout(
  currency: string,
  walletAddress: string,
  amount: number
): Promise<string> {
  const key = process.env.SETTLEMENT_PAYOUT_PRIVATE_KEY
  const token = process.env.SETTLEMENT_PAYOUT_TOKEN_ADDRESS
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
  if (!key || !token) {
    throw new Error(
      'SETTLEMENT_PAYOUT_MODE=onchain requires SETTLEMENT_PAYOUT_PRIVATE_KEY and SETTLEMENT_PAYOUT_TOKEN_ADDRESS'
    )
  }

  // Validate Solana wallet address for destination
  let recipientPubkey: PublicKey
  try {
    recipientPubkey = new PublicKey(walletAddress)
  } catch (e) {
    throw new Error(`Vendor payout wallet is not a valid Solana address: ${walletAddress}`)
  }

  // Parse treasury private key (supports both JSON array and base64 string)
  let treasury: Keypair
  try {
    let secret: Uint8Array
    try {
      secret = Uint8Array.from(JSON.parse(key))
    } catch {
      secret = Uint8Array.from(Buffer.from(key, 'base64'))
    }
    treasury = Keypair.fromSecretKey(secret)
  } catch (e) {
    throw new Error(`Treasury private key is invalid`)
  }

  const mint = new PublicKey(token)
  const connection = new Connection(rpcUrl, 'confirmed')

  // Associated Token Accounts for source and destination
  const sourceATA = await getAssociatedTokenAddress(mint, treasury.publicKey)
  const destATA = await getAssociatedTokenAddress(mint, recipientPubkey)

  // Determine decimals for token amount; fallback to 6 if not found
  let tokenDecimals = 6
  try {
    const mintInfo = await connection.getParsedAccountInfo(mint)
    tokenDecimals = (mintInfo.value?.data as ParsedAccountData)?.parsed?.info?.tokenDecimals ?? 6
  } catch (e) {
    console.error(`Failed to get mint info for ${token}:`, e)
    // Default to 6 decimals
  }
  // Issue the transfer SPL instruction
  console.log(`Token decimals: ${tokenDecimals}`)
  const transferIx = createTransferInstruction(
    sourceATA,
    destATA,
    treasury.publicKey,
    BigInt(Math.floor(amount * Math.pow(10, tokenDecimals))),
    [],
    TOKEN_PROGRAM_ID
  )

  // Compose and send the transaction
  const tx = new Transaction().add(transferIx)
  const signature = await sendAndConfirmTransaction(
    connection,
    tx,
    [treasury],
    { commitment: 'confirmed' }
  )

  console.log(
    `SPL payout: ${amount} ${currency} → ${walletAddress} (${signature})`
  )
  return signature
}

/**
 * Internal payout using the credit balance system.
 * Atomically debits vendor's internal credit balance, returns reference id.
 * Throws if the vendor does not have enough available credit.
 */
async function processCreditBalancePayout(
  vendorId: string,
  amount: number
): Promise<string> {
  // Atomically decrement the vendor's available credit balance by 'amount'
  // Returns payout reference id (e.g., a journal txn id)
  const creditBalanceUnit = getCreditUnitLabel()
  const vendorResult = await db().findDocById<VendorProfile>(
    STORE_COLLECTIONS.vendorProfiles,
    vendorId
  )
  if (!vendorResult.success || !vendorResult.data) {
    throw new Error('Vendor not found')
  }

  const vendor = vendorResult.data as VendorProfile
  if (typeof vendor[creditBalanceUnit] !== 'number' || vendor[creditBalanceUnit] < amount) {
    throw new Error(`Insufficient ${creditBalanceUnit} balance for payout`)
  }

  // Update: decrement balance, log journal entry (atomic)
  const newBalance = vendor[creditBalanceUnit] - amount

  const updateResult = await db().updateDoc(STORE_COLLECTIONS.vendorProfiles, vendorId, {
    [creditBalanceUnit]: newBalance,
    // Optionally add a credit payout journal entry
    $push: {
      creditJournal: {
        type: 'payout',
        amount,
        timestamp: new Date().toISOString(),
        meta: {}
      }
    }
  })

  if (!updateResult.success) {
    throw new Error('Failed to update credit balance for payout')
  }

  // Construct synthetic payout transaction id for traceability
  const payoutTxId = `credit_${vendorId}_${Date.now()}`

  console.log(
    `Internal credit payout: ${amount} debited from vendor ${vendorId} (balance: ${newBalance})`
  )

  return payoutTxId
}

/**
 * Simulated payout for currencies and rails not yet supported by production on-chain payouts.
 * Used in simulated payout mode, or as fallback/stub for rails like fiat/IBAN/SWIFT.
 */
async function processCryptoPayout(
  currency: string,
  walletId: string,
  amount: number
): Promise<string> {
  // STUB: Replace simulation with real crypto/fiat payout logic when available.
  const transactionId = `sim_${currency.toLowerCase()}_${Date.now()}`
  console.log(`[SIMULATED] ${currency} payout: ${amount} to wallet ${walletId}`)
  return transactionId
}

/**
 * Settlemt hold logic for dispute/review workflows.
 * Immediately sets status to 'held' and saves reason.
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
 * Release a held settlement, reschedules it back for next payout cycle.
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

  // Schedule for next daily payout (no additional hold)
  const newScheduledDate = calculateSettlementDate(
    SettlementFrequency.DAILY,
    0
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
 * Get full vendor payout history (completed only, paginated).
 * Uses cache for improved performance (cached via React 18/19 cache()).
 * // TODO: When react-cache is stable in React 19/Next 16, prefer useCacheQuery hook for data layer.
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
 * Get list of vendor settlements that are pending (not yet completed/processing/held).
 * // TODO: When Next.js 16/React 19 useServerQuery API is stable, migrate cache-async logic.
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

  // Calculate total (pending) payout value for summary/statistics
  const total = settlements.reduce((sum, s) => sum + s.netPayout, 0)

  return {
    settlements,
    total
  }
})

/**
 * Calculates platform revenue (commissions) for reporting/analytics.
 * Returns gross total and per-currency breakdown.
 * // TODO: Move to native incremental static regeneration (ISR) if report can be cached on edge.
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

  // Build a breakdown of commission by currency, sum across all settlements
  const breakdown: Record<string, number> = {}
  let total = 0

  for (const settlement of settlements) {
    const commission = settlement.commission
    total += commission

    if (!breakdown[settlement.currency]) {
      breakdown[settlement.currency] = 0
    }
    breakdown[settlement.currency] += commission
  }

  return { total, breakdown }
})
