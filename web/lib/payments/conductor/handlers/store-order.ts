/**
 * WayForPay store-order webhook adapter.
 *
 * Translates the WFP payload into the shared fulfillment contract; all paid-order
 * side effects live in `fulfillStoreOrderPaid`. The order records rail `card`
 * with processor `wayforpay` — never `method: 'wayforpay'`.
 */

import { logger } from '@/lib/logger'
import {
  processStorePaymentWebhook,
  type StoreWebhookPayload,
} from '@/lib/payments/wayforpay-store-service'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { restoreStockForOrder } from '@/features/store/services/inventory-sync'
import { fulfillStoreOrderPaid } from '@/lib/payments/conductor/fulfill-store-order-paid'
import type { StorePayment } from '@/features/store/types'

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
    return fulfillStoreOrderPaid({
      orderId,
      orderReference,
      amount: payload.amount,
      currency: payload.currency,
      rail: 'card',
      processor: 'wayforpay',
      processorPayload: payload as unknown as Record<string, unknown>,
      paymentDetails: {
        wayforpayOrderId: orderReference,
        wayforpayTransactionId: orderReference,
        cardLast4: payload.cardPan ? payload.cardPan.slice(-4) : undefined,
        cardType: payload.cardType,
        paymentSystem: payload.paymentSystem,
      },
      source: 'WayForPay store',
    })
  }

  const failed = ['Declined', 'Expired', 'Refunded', 'Voided'].includes(payload.transactionStatus)

  await StoreOrdersService.updateOrderPaymentStatus(orderId, {
    method: 'card',
    processor: 'wayforpay',
    status: mapTransactionStatus(payload.transactionStatus),
    wayforpayOrderId: orderReference,
    amount: payload.amount,
    currency: payload.currency,
    ...(failed ? { failureReason: `${payload.reason} (Code: ${payload.reasonCode})` } : {}),
  })

  if (payload.transactionStatus === 'Refunded' || payload.transactionStatus === 'Voided') {
    try {
      await restoreStockForOrder(orderId)
    } catch (restoreError) {
      logger.error('WayForPay store: stock restore failed', { orderId, restoreError })
    }
  }

  return { success: true, orderId }
}
