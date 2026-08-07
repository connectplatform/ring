import 'server-only'

import { creditBalanceService } from '@/features/wallet/services/credit-balance-service'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { logger } from '@/lib/logger'

/**
 * WayForPay webhook handler for wallet credit top-up.
 * Credits user balance with paid fiat amount (1:1 points when main_currency_rate=1).
 */
export async function handleWalletTopupWayForPayWebhook(
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
    logger.info('Wallet topup WFP webhook: already paid', { orderReference })
    return true
  }

  const tx = await paymentTransactionService.findByOrderReference(orderReference)
  if (!tx?.user_id) {
    logger.error('Wallet topup WFP webhook: missing userId', { orderReference, tx })
    return false
  }

  const amount =
    typeof payload.amount === 'number'
      ? payload.amount
      : typeof tx.amount_minor === 'number'
        ? tx.amount_minor / 100
        : 0

  if (amount <= 0) {
    logger.error('Wallet topup WFP webhook: invalid amount', { orderReference, amount })
    return false
  }

  await creditBalanceService.addFiatUsd(
    tx.user_id,
    String(Math.floor(amount)),
    `Credit top-up via WayForPay (${orderReference})`,
    'top_up',
    { orderReference, processor: 'wayforpay' },
  )

  logger.info('Wallet topup WFP webhook: credited', {
    userId: tx.user_id,
    amount,
    orderReference,
  })

  try {
    const { appendEvent } = await import('@/lib/events/event-log.server')
    await appendEvent({
      type: 'wallet_topup_paid',
      userId: tx.user_id,
      reversible: false,
      payload: { orderReference, amount, processor: 'wayforpay' },
    })
  } catch {
    // non-blocking
  }

  return true
}
