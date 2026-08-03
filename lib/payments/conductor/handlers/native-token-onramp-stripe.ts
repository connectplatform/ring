import 'server-only'

import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { settleNativeTokenOnramp } from '@/lib/payments/conductor/settle-native-token-onramp'
import { logger } from '@/lib/logger'

/**
 * Stripe webhook — purpose native_token_onramp.
 */
export async function handleNativeTokenOnrampStripeWebhook(event: {
  type: string
  data: { object: Record<string, unknown> }
}): Promise<boolean> {
  if (event.type !== 'checkout.session.completed') {
    return false
  }

  const session = event.data.object as Record<string, unknown>
  const metadata = (session.metadata ?? {}) as Record<string, string>
  const orderReference = String(metadata.orderReference ?? '')
  const userId = String(metadata.userId ?? metadata.ring_user_id ?? '')

  if (!orderReference || !userId) {
    logger.error('Stripe native onramp webhook: missing metadata', {
      sessionId: session.id,
      metadata,
    })
    return false
  }

  const isNew = await paymentTransactionService.markPaid(
    orderReference,
    session as Record<string, unknown>,
  )
  if (!isNew) {
    logger.info('Stripe native onramp webhook: already paid', { orderReference })
    return true
  }

  const amount =
    typeof session.amount_total === 'number' ? session.amount_total / 100 : 0

  if (amount <= 0) {
    logger.error('Stripe native onramp webhook: invalid amount', { orderReference, amount })
    return false
  }

  const settled = await settleNativeTokenOnramp({
    userId,
    mainCurrencyAmount: amount,
    orderReference,
    processor: 'stripe',
  })

  if (!settled.ok) {
    logger.error('Stripe native onramp webhook: settle failed', {
      orderReference,
      error: settled.error,
    })
    return false
  }

  return true
}
