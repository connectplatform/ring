import 'server-only'

import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { logger } from '@/lib/logger'
import {
  amountNativeTokenFromPaidTx,
  settlePublicPoolCardContribution,
} from '@/lib/payments/conductor/settle-public-pool-contribution'
import { parseOrderReference } from '@/lib/payments/order-reference'

export async function handlePublicPoolContributionWayForPayWebhook(
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
    logger.info('Public pool card WFP: already paid', { orderReference })
    return true
  }

  const parsed = parseOrderReference(orderReference)
  const resolved = await amountNativeTokenFromPaidTx(orderReference)
  if (!resolved && !parsed?.entityId) {
    logger.error('Public pool card WFP: missing pool/amount', { orderReference })
    return false
  }

  const userId = resolved?.userId ?? parsed?.userId
  const poolSlug = resolved?.poolSlug ?? parsed?.entityId
  const amountNativeToken = resolved?.amountNativeToken
  if (!userId || !poolSlug || !amountNativeToken) {
    logger.error('Public pool card WFP: incomplete settlement data', {
      orderReference,
      userId,
      poolSlug,
      amountNativeToken,
    })
    return false
  }

  return settlePublicPoolCardContribution({
    orderReference,
    userId,
    poolSlug,
    amountNativeToken,
    processor: 'wayforpay',
  })
}

export async function handlePublicPoolContributionStripeWebhook(
  session: Record<string, unknown>,
): Promise<boolean> {
  const metadata = (session.metadata ?? {}) as Record<string, unknown>
  const orderReference = String(metadata.orderReference ?? '')
  if (!orderReference) {
    logger.error('Public pool card Stripe: missing orderReference')
    return false
  }

  const isNew = await paymentTransactionService.markPaid(orderReference, session)
  if (!isNew) {
    logger.info('Public pool card Stripe: already paid', { orderReference })
    return true
  }

  const resolved = await amountNativeTokenFromPaidTx(orderReference)
  const poolSlug = String(metadata.poolSlug ?? resolved?.poolSlug ?? '').trim()
  const userId = String(metadata.userId ?? resolved?.userId ?? '').trim()
  const amountNativeToken = String(
    metadata.amountNativeToken ?? resolved?.amountNativeToken ?? '',
  ).trim()

  if (!userId || !poolSlug || !amountNativeToken) {
    logger.error('Public pool card Stripe: incomplete settlement data', {
      orderReference,
      userId,
      poolSlug,
      amountNativeToken,
    })
    return false
  }

  return settlePublicPoolCardContribution({
    orderReference,
    userId,
    poolSlug,
    amountNativeToken,
    processor: 'stripe',
  })
}
