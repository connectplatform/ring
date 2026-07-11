import 'server-only'

import { creditBalanceService } from '@/features/wallet/services/credit-balance-service'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { logger } from '@/lib/logger'

/**
 * Stripe webhook handler for wallet credit top-up (`metadata.purpose === 'wallet_topup'`).
 * Credits fiat points 1:1 — same settlement as WayForPay wallet-topup handler.
 * Does NOT credit on-chain native token balance (use Token Desk for credit→RING).
 */
export async function handleWalletTopupStripeWebhook(event: {
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
    logger.error('Stripe wallet topup webhook: missing metadata', {
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
    logger.info('Stripe wallet topup webhook: already paid', { orderReference })
    return true
  }

  const amount =
    typeof session.amount_total === 'number' ? session.amount_total / 100 : 0

  if (amount <= 0) {
    logger.error('Stripe wallet topup webhook: invalid amount', { orderReference, amount })
    return false
  }

  await creditBalanceService.addFiatUsd(
    userId,
    String(Math.floor(amount)),
    `Credit top-up via Stripe (${orderReference})`,
    'top_up',
    { orderReference, processor: 'stripe' },
  )

  logger.info('Stripe wallet topup webhook: credited', {
    userId,
    amount,
    orderReference,
  })

  try {
    const { appendEvent } = await import('@/lib/events/event-log.server')
    await appendEvent({
      type: 'wallet_topup_paid',
      userId,
      reversible: false,
      payload: { orderReference, amount, processor: 'stripe' },
    })
  } catch {
    // non-blocking
  }

  return true
}
