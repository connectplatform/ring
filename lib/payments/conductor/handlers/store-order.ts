import { logger } from '@/lib/logger'
import {
  processStorePaymentWebhook,
  type StoreWebhookPayload,
} from '@/lib/payments/wayforpay-store-service'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { VendorSettlementService } from '@/features/store/services/vendor-settlement'
import { ERPStockService } from '@/features/store/services/erp-stock-service'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import type { StorePayment, StoreOrder } from '@/features/store/types'
import { ReferralRewardService } from '@/features/refcodes/services/referral-reward-service'

function mapTransactionStatus(wayforpayStatus: string): StorePayment['status'] {
  const statusMap: Record<string, StorePayment['status']> = {
    InProcessing: 'processing',
    WaitingAuthComplete: 'processing',
    Approved: 'paid',
    Pending: 'pending',
    Declined: 'failed',
    Expired: 'cancelled',
    Refunded: 'refunded',
    Voided: 'cancelled',
    RefundInProcessing: 'processing',
  }
  return statusMap[wayforpayStatus] || 'pending'
}

export async function handleStoreWayForPayWebhook(
  payload: StoreWebhookPayload
): Promise<{ success: boolean; orderId?: string }> {
  const result = await processStorePaymentWebhook(payload)
  if (!result.success || !result.orderId) {
    return { success: false }
  }

  const orderId = result.orderId
  const orderReference = payload.orderReference

  if (payload.transactionStatus === 'Approved') {
    const isNew = await paymentTransactionService.markPaid(orderReference, payload as unknown as Record<string, unknown>)

    const paymentData: StorePayment = {
      method: 'wayforpay',
      status: 'paid',
      wayforpayOrderId: orderReference,
      wayforpayTransactionId: orderReference,
      amount: payload.amount,
      currency: payload.currency,
      cardLast4: payload.cardPan ? payload.cardPan.slice(-4) : undefined,
      cardType: payload.cardType,
      paymentSystem: payload.paymentSystem,
      paidAt: new Date().toISOString(),
    }

    if (isNew) {
      await StoreOrdersService.updateOrderPaymentStatus(orderId, paymentData)
      await StoreOrdersService.adminUpdateOrderStatus(orderId, 'paid')

      const order = await StoreOrdersService.getOrderWithPaymentDetails(orderId)

      if (order?.items?.length) {
        try {
          await ERPStockService.deductStockForOrder(orderId, order.items, order.userId, {
            referralCode: order.referralCode,
            assisted: Boolean(order.referralCode),
          })
        } catch (stockError) {
          logger.error('Store webhook: stock deduction failed', { orderId, stockError })
        }
      }

      if (order?.vendorSettlements?.length) {
        try {
          await VendorSettlementService.processSettlements(orderId, {
            paymentMethod: 'wayforpay',
            transactionId: orderReference,
            amount: payload.amount,
            currency: payload.currency,
          })
        } catch (settlementError) {
          logger.error('Store webhook: settlement failed', { orderId, settlementError })
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
          logger.error('Store webhook: referral reward failed', { orderId, referralError })
        }
      }
    }
  } else if (['Declined', 'Expired', 'Refunded', 'Voided'].includes(payload.transactionStatus)) {
    await StoreOrdersService.updateOrderPaymentStatus(orderId, {
      method: 'wayforpay',
      status: mapTransactionStatus(payload.transactionStatus),
      wayforpayOrderId: orderReference,
      failureReason: `${payload.reason} (Code: ${payload.reasonCode})`,
      amount: payload.amount,
      currency: payload.currency,
    })
  } else {
    await StoreOrdersService.updateOrderPaymentStatus(orderId, {
      method: 'wayforpay',
      status: mapTransactionStatus(payload.transactionStatus),
      wayforpayOrderId: orderReference,
      amount: payload.amount,
      currency: payload.currency,
    })
  }

  return { success: true, orderId }
}
