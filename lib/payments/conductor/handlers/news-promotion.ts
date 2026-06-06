import { markPaymentReceived } from '@/features/news/services/news-promotion-workflow'
import { notifyAdminsNewsAwaitingApproval } from '@/features/news/services/news-telegram-approval'
import { decodeArticleIdFromOrderReference } from '@/lib/payments/order-reference'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { logger } from '@/lib/logger'

export async function handleNewsWayForPayWebhook(
  payload: Record<string, unknown>
): Promise<boolean> {
  const orderReference = String(payload.orderReference ?? '')
  const transactionStatus = String(payload.transactionStatus ?? '')

  if (transactionStatus !== 'Approved') {
    return false
  }

  const articleId = decodeArticleIdFromOrderReference(orderReference)
  if (!articleId) {
    logger.error('News WFP webhook: invalid order reference', { orderReference })
    return false
  }

  const isNew = await paymentTransactionService.markPaid(orderReference, payload as Record<string, unknown>)
  if (!isNew) {
    logger.info('News WFP webhook: already paid', { orderReference })
    return true
  }

  await markPaymentReceived(articleId, {
    provider: 'wayforpay',
    orderReference,
    amount: payload.amount as number | undefined,
    currency: payload.currency as string | undefined,
  })
  await notifyAdminsNewsAwaitingApproval(articleId)
  return true
}

export async function handleNewsStripeWebhook(event: {
  type: string
  data: { object: Record<string, unknown> }
}): Promise<boolean> {
  if (event.type !== 'checkout.session.completed') return false

  const session = event.data.object as Record<string, unknown>
  const metadata = (session.metadata ?? {}) as Record<string, string>
  const orderReference = String(metadata.orderReference ?? '')
  const articleId =
    String(metadata.articleId ?? '') ||
    decodeArticleIdFromOrderReference(orderReference)

  if (!articleId || !orderReference) {
    logger.error('Stripe news webhook: missing metadata', { sessionId: session.id })
    return false
  }

  const isNew = await paymentTransactionService.markPaid(orderReference, session as Record<string, unknown>)
  if (!isNew) return true

  await markPaymentReceived(articleId, {
    provider: 'stripe',
    orderReference,
    amount: typeof session.amount_total === 'number' ? session.amount_total / 100 : undefined,
    currency: String(session.currency ?? 'uah').toUpperCase(),
  })
  await notifyAdminsNewsAwaitingApproval(articleId)
  return true
}
