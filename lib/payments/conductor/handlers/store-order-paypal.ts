/**
 * PayPal Store Order webhook fulfillment.
 * Mirrors Stripe store handler — markPaid → stock / settlements / referrals (idempotent).
 */

import { logger } from '@/lib/logger'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { VendorSettlementService } from '@/features/store/services/vendor-settlement'
import { ERPStockService } from '@/features/store/services/erp-stock-service'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { ReferralRewardService } from '@/features/refcodes/services/referral-reward-service'
import type { StorePayment, StoreOrder } from '@/features/store/types'

export async function handleStorePayPalCapture(opts: {
  orderReference: string
  orderId: string
  amount: number
  currency: string
  processorPayload: Record<string, unknown>
}): Promise<{ success: boolean; orderId?: string }> {
  const { orderReference, orderId, amount, currency, processorPayload } = opts

  if (!orderReference || !orderId) {
    logger.error('PayPal store webhook: missing ids', { orderReference, orderId })
    return { success: false }
  }

  const isNew = await paymentTransactionService.markPaid(orderReference, processorPayload)

  const paymentData: StorePayment = {
    method: 'paypal',
    status: 'paid',
    amount,
    currency: currency.toUpperCase(),
    paidAt: new Date().toISOString(),
  }

  await StoreOrdersService.updateOrderPaymentStatus(orderId, paymentData)
  await StoreOrdersService.adminUpdateOrderStatus(orderId, 'paid')

  if (isNew) {
    const order = await StoreOrdersService.getOrderWithPaymentDetails(orderId)

    if (order?.items?.length) {
      try {
        await ERPStockService.deductStockForOrder(orderId, order.items, order.userId, {
          referralCode: order.referralCode,
          assisted: Boolean(order.referralCode),
        })
      } catch (stockError) {
        logger.error('PayPal store: stock deduction failed', { orderId, stockError })
      }
    }

    if (order?.vendorSettlements?.length) {
      try {
        await VendorSettlementService.processSettlements(orderId, {
          paymentMethod: 'paypal',
          transactionId: orderReference,
          amount,
          currency: currency.toUpperCase(),
        })
      } catch (settlementError) {
        logger.error('PayPal store: settlement failed', { orderId, settlementError })
      }
    }

    if (order) {
      try {
        await ReferralRewardService.onOrderPaid({
          order: order as StoreOrder,
          orderReference,
          rail: 'fiat',
        })
      } catch (referralError) {
        logger.error('PayPal store: referral reward failed', { orderId, referralError })
      }
    }

    logger.info('PayPal store order: completed', { orderId, orderReference, amount, currency })
  }

  return { success: true, orderId }
}
