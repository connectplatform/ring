import 'server-only'

import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { settleNativeTokenOnramp } from '@/lib/payments/conductor/settle-native-token-onramp'
import { logger } from '@/lib/logger'

/**
 * WayForPay webhook — purpose native_token_onramp (card → treasury RING transfer).
 */
export async function handleNativeTokenOnrampWayForPayWebhook(
  payload: Record<string, unknown>,
): Promise<boolean> {
  const orderReference = String(payload.orderReference ?? '')
  const transactionStatus = String(payload.transactionStatus ?? '')

  if (transactionStatus !== 'Approved') {
    return false
  }

  const isNew = await paymentTransactionService.markPaid(
    orderReference,
    payload as Record<string, unknown>,
  )
  if (!isNew) {
    logger.info('Native onramp WFP webhook: already paid', { orderReference })
    return true
  }

  const tx = await paymentTransactionService.findByOrderReference(orderReference)
  if (!tx?.user_id) {
    logger.error('Native onramp WFP webhook: missing userId', { orderReference, tx })
    return false
  }

  const amount =
    typeof payload.amount === 'number'
      ? payload.amount
      : typeof tx.amount_minor === 'number'
        ? tx.amount_minor / 100
        : 0

  if (amount <= 0) {
    logger.error('Native onramp WFP webhook: invalid amount', { orderReference, amount })
    return false
  }

  const settled = await settleNativeTokenOnramp({
    userId: tx.user_id,
    fiatAmount: amount,
    orderReference,
    processor: 'wayforpay',
  })

  if (!settled.ok) {
    logger.error('Native onramp WFP webhook: settle failed', {
      orderReference,
      error: settled.error,
    })
    return false
  }

  return true
}
