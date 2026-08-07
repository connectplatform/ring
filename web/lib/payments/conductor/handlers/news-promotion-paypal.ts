import 'server-only'

import { markPaymentReceived } from '@/features/news/services/news-promotion-workflow'
import { decodeArticleIdFromOrderReference } from '@/lib/payments/order-reference'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { logger } from '@/lib/logger'

export async function handleNewsPayPalCapture(opts: {
  orderReference: string
  processorPayload: Record<string, unknown>
}): Promise<boolean> {
  const { orderReference, processorPayload } = opts
  const articleId = decodeArticleIdFromOrderReference(orderReference)
  if (!articleId) {
    logger.error('News PayPal webhook: invalid order reference', { orderReference })
    return false
  }

  const isNew = await paymentTransactionService.markPaid(orderReference, processorPayload)
  if (!isNew) {
    logger.info('News PayPal webhook: already paid', { orderReference })
    return true
  }

  await markPaymentReceived(articleId, {
    orderReference,
    processor: 'paypal',
  })

  logger.info('News PayPal webhook: promotion paid', { articleId, orderReference })
  return true
}
