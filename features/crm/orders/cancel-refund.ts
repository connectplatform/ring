import 'server-only'

import { refundStorePayment } from '@/lib/payments/wayforpay-store-service'
import { creditBalanceService } from '@/features/wallet/services/credit-balance-service'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import {
  closeProjectOrderOpportunity,
  ProjectOrderService,
} from '@/features/crm/orders/project-order-service'
import { revokeOrderSourceToken } from '@/features/crm/lab/order-source-auth-service'
import { logger } from '@/lib/logger'

/** Best-effort: revoke per-order Forgejo PAT. Never blocks cancel/refund. Robot GC is separate. */
async function revokeSourceAuthBestEffort(orderId: string): Promise<void> {
  try {
    await revokeOrderSourceToken(orderId)
  } catch (error) {
    logger.warn('Order source PAT revoke on cancel failed (non-blocking)', {
      orderId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Cancel a paid project order and refund (WFP / credit). Marks work canceled.
 */
export async function cancelAndRefundProjectOrder(
  orderId: string,
  comment = 'Project order canceled',
): Promise<{ success: boolean; error?: string }> {
  const order = await ProjectOrderService.getById(orderId)
  if (!order) return { success: false, error: 'Order not found' }

  if (order.workStatus === 'canceled' && order.paymentStatus === 'refunded') {
    // Idempotent revoke for legacy rows canceled before revoke wiring
    await revokeSourceAuthBestEffort(orderId)
    return { success: true }
  }

  if (order.paymentStatus !== 'paid' && order.paymentStatus !== 'pending_payment') {
    await ProjectOrderService.setWorkStatus(orderId, 'canceled')
    await closeProjectOrderOpportunity(order.opportunityId)
    await revokeSourceAuthBestEffort(orderId)
    return { success: true }
  }

  const orderReference = order.orderReference
  let refundReference = `refund_${orderId}_${Date.now()}`

  if (orderReference) {
    const tx = await paymentTransactionService.findByOrderReference(orderReference)
    const processor = tx?.processor

    if (processor === 'credit_balance') {
      try {
        await creditBalanceService.addFiatUsd(
          order.userId,
          String(order.amount),
          `Refund project order ${orderId}`,
          'desk_refund',
          { orderReference, purpose: 'project_order' },
        )
        refundReference = `credit_refund_${orderReference}`
      } catch (error) {
        logger.error('Project order credit refund failed', { orderId, error })
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Credit refund failed',
        }
      }
    } else if (processor === 'wayforpay') {
      const result = await refundStorePayment(
        orderReference,
        order.amount,
        order.currency,
        comment,
      )
      if (!result.success) {
        return { success: false, error: result.error ?? 'WayForPay refund failed' }
      }
      refundReference = result.refundId ?? refundReference
    } else if (processor === 'stripe') {
      return {
        success: false,
        error:
          'Stripe refund is not automated yet. Refund in Stripe Dashboard, then mark canceled after confirmation — or use credit/WayForPay rails.',
      }
    } else {
      return {
        success: false,
        error: processor
          ? `Cannot auto-refund processor "${processor}". Complete refund manually before cancel.`
          : 'Payment transaction processor unknown — complete refund manually before cancel.',
      }
    }
  }

  await ProjectOrderService.markRefunded(orderId, refundReference)
  await closeProjectOrderOpportunity(order.opportunityId)
  await revokeSourceAuthBestEffort(orderId)
  return { success: true }
}
