import 'server-only'

import { creditBalanceService } from '@/features/wallet/services/credit-balance-service'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { logger } from '@/lib/logger'

/**
 * PayPal wallet_topup — credit units 1:1 with captured fiat (never RING).
 */
export async function handleWalletTopupPayPalCapture(opts: {
  orderReference: string
  amount: number
  processorPayload: Record<string, unknown>
}): Promise<boolean> {
  const { orderReference, amount, processorPayload } = opts

  const isNew = await paymentTransactionService.markPaid(orderReference, processorPayload)
  if (!isNew) {
    logger.info('Wallet topup PayPal webhook: already paid', { orderReference })
    return true
  }

  const tx = await paymentTransactionService.findByOrderReference(orderReference)
  if (!tx?.user_id) {
    logger.error('Wallet topup PayPal webhook: missing userId', { orderReference, tx })
    return false
  }

  const creditAmount = amount > 0 ? amount : (tx.amount_minor ?? 0) / 100
  if (creditAmount <= 0) {
    logger.error('Wallet topup PayPal webhook: invalid amount', { orderReference, creditAmount })
    return false
  }

  await creditBalanceService.addFiatUsd(
    tx.user_id,
    String(Math.floor(creditAmount)),
    `Credit top-up via PayPal (${orderReference})`,
    'top_up',
    { orderReference, processor: 'paypal' },
  )

  logger.info('Wallet topup PayPal webhook: credited', {
    userId: tx.user_id,
    amount: creditAmount,
    orderReference,
  })

  return true
}
