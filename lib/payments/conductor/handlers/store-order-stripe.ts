/**
 * Stripe Store Order Webhook Handler.
 *
 * Handles `checkout.session.completed` events for `metadata.purpose === 'store_order'`.
 * Marks order as paid, deducts stock, processes vendor settlements, triggers referrals.
 *
 * Mirrors `handleStoreWayForPayWebhook` but reads from Stripe session metadata
 * instead of WayForPay webhook payload fields.
 */

import { logger } from '@/lib/logger'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { VendorSettlementService } from '@/features/store/services/vendor-settlement'
import { ERPStockService } from '@/features/store/services/erp-stock-service'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { ReferralRewardService } from '@/features/refcodes/services/referral-reward-service'
import type { StorePayment, StoreOrder } from '@/features/store/types'

export async function handleStoreStripeWebhook(event: {
  type: string
  data: { object: Record<string, unknown> }
}): Promise<{ success: boolean; orderId?: string }> {
  if (event.type !== 'checkout.session.completed') {
    return { success: false }
  }

  const session = event.data.object as Record<string, unknown>
  const metadata = (session.metadata ?? {}) as Record<string, string>
  const orderReference = String(metadata.orderReference ?? '')
  const orderId = String(metadata.entityId ?? '')

  if (!orderReference || !orderId) {
    logger.error('Stripe store webhook: missing metadata', {
      sessionId: session.id,
      metadata,
    })
    return { success: false }
  }

  // Check idempotency
  const isNew = await paymentTransactionService.markPaid(
    orderReference,
    session as Record<string, unknown>,
  )

  const amount = typeof session.amount_total === 'number'
    ? session.amount_total / 100
    : 0
  const currency = String(session.currency ?? 'usd').toUpperCase()

  const paymentData: StorePayment = {
    method: 'stripe',
    status: 'paid',
    stripeSessionId: String(session.id ?? ''),
    amount,
    currency,
    paidAt: new Date().toISOString(),
  }

  // Always update payment status (even if idempotent — ensures latest state)
  await StoreOrdersService.updateOrderPaymentStatus(orderId, paymentData)
  await StoreOrdersService.adminUpdateOrderStatus(orderId, 'paid')

  // Only process side-effects on first payment
  if (isNew) {
    const order = await StoreOrdersService.getOrderWithPaymentDetails(orderId)

    // Stock deduction
    if (order?.items?.length) {
      try {
        await ERPStockService.deductStockForOrder(orderId, order.items, order.userId, {
          referralCode: order.referralCode,
          assisted: Boolean(order.referralCode),
        })
      } catch (stockError) {
        logger.error('Stripe store: stock deduction failed', { orderId, stockError })
      }
    }

    // Vendor settlements
    if (order?.vendorSettlements?.length) {
      try {
        await VendorSettlementService.processSettlements(orderId, {
          paymentMethod: 'stripe',
          transactionId: String(session.id ?? orderReference),
          amount,
          currency,
        })
      } catch (settlementError) {
        logger.error('Stripe store: settlement failed', { orderId, settlementError })
      }
    }

    // Referral rewards
    if (order) {
      try {
        await ReferralRewardService.onOrderPaid({
          order: order as StoreOrder,
          orderReference,
          rail: 'fiat',
        })
      } catch (referralError) {
        logger.error('Stripe store: referral reward failed', { orderId, referralError })
      }
    }

    logger.info('Stripe store order: completed', {
      orderId,
      orderReference,
      amount,
      currency,
    })
  }

  return { success: true, orderId }
}
