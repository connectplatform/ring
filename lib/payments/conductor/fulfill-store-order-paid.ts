/**
 * Shared store-order paid fulfillment.
 *
 * Every processor (WayForPay, Stripe, PayPal, credit balance, native token) funnels
 * through here so the paid-order side effects — ledger idempotency, order status,
 * stock commit, vendor settlements, referral rewards — exist in exactly one place.
 *
 * Processors only adapt their payload into `StoreOrderPaidInput`; they must not
 * re-implement fulfillment or persist a PSP id as the order's payment method.
 */

import 'server-only'

import { logger } from '@/lib/logger'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { VendorSettlementService } from '@/features/store/services/vendor-settlement'
import { commitSaleForOrder } from '@/features/store/services/inventory-sync'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { ReferralRewardService } from '@/features/refcodes/services/referral-reward-service'
import type { ReferralRewardRail } from '@/features/refcodes/types'
import type { StoreOrder, StorePayment, StorePaymentProcessor, StorePaymentRail } from '@/features/store/types'

export interface StoreOrderPaidInput {
  orderId: string
  orderReference: string
  amount: number
  /** ISO code the buyer was charged in. */
  currency: string
  /** User-facing rail persisted on the order. */
  rail: StorePaymentRail
  /** PSP that actually settled — ops/reporting only. */
  processor: StorePaymentProcessor
  /** Raw processor payload, stored for idempotency + audit. */
  processorPayload: Record<string, unknown>
  /** Rail-specific extras merged into the persisted payment blob (card last4, session id, …). */
  paymentDetails?: Partial<StorePayment>
  /** Label used in log lines, e.g. "WayForPay store". */
  source?: string
}

/** Card and PayPal settlements need admin approval; internal rails are pre-trusted. */
function referralRailForPaymentRail(rail: StorePaymentRail): ReferralRewardRail {
  if (rail === 'credit_balance') return 'credit_balance'
  if (rail === 'native_token') return 'native_token'
  return 'main_currency'
}

export async function fulfillStoreOrderPaid(
  input: StoreOrderPaidInput,
): Promise<{ success: boolean; orderId?: string }> {
  const {
    orderId,
    orderReference,
    amount,
    rail,
    processor,
    processorPayload,
    paymentDetails,
    source = 'Store order',
  } = input
  const currency = input.currency.toUpperCase()

  if (!orderId || !orderReference) {
    logger.error(`${source}: missing order ids`, { orderId, orderReference })
    return { success: false }
  }

  const isNew = await paymentTransactionService.markPaid(orderReference, processorPayload)

  const payment: StorePayment = {
    method: rail,
    processor,
    status: 'paid',
    amount,
    currency,
    paidAt: new Date().toISOString(),
    ...paymentDetails,
  }

  await StoreOrdersService.updateOrderPaymentStatus(orderId, payment)
  await StoreOrdersService.adminUpdateOrderStatus(orderId, 'paid')

  // Side effects run once per order, guarded by the ledger's idempotency check.
  if (!isNew) {
    return { success: true, orderId }
  }

  const order = await StoreOrdersService.getOrderWithPaymentDetails(orderId)

  if (order?.items?.length) {
    try {
      await commitSaleForOrder(orderId, order.items, order.userId, {
        referralCode: order.referralCode,
        assisted: Boolean(order.referralCode),
      })
    } catch (stockError) {
      logger.error(`${source}: stock commit failed`, { orderId, stockError })
    }
  }

  if (order?.vendorSettlements?.length) {
    try {
      await VendorSettlementService.processSettlements(orderId, {
        paymentMethod: rail,
        transactionId: orderReference,
        amount,
        currency,
      })
    } catch (settlementError) {
      logger.error(`${source}: settlement failed`, { orderId, settlementError })
    }
  }

  if (order) {
    try {
      await ReferralRewardService.onOrderPaid({
        order: order as StoreOrder,
        orderReference,
        rail: referralRailForPaymentRail(rail),
      })
    } catch (referralError) {
      logger.error(`${source}: referral reward failed`, { orderId, referralError })
    }
  }

  logger.info(`${source}: completed`, { orderId, orderReference, amount, currency, processor })
  return { success: true, orderId }
}
