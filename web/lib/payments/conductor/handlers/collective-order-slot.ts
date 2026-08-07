import 'server-only'

import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { parseOrderReference } from '@/lib/payments/order-reference'
import { collectiveOrderEscrowService } from '@/features/opportunities/services/collective-order-escrow-service'
import { logger } from '@/lib/logger'

function extractCollectiveOrderEscrowId(
  orderReference: string,
  payload?: Record<string, unknown>,
): string | null {
  const fromMeta = payload?.collectiveOrderEscrowId ?? payload?.entityId
  if (typeof fromMeta === 'string' && fromMeta) return fromMeta

  const parsed = parseOrderReference(orderReference)
  if (parsed?.purpose === 'collective_order_slot' && parsed.entityId) {
    return parsed.entityId
  }
  return null
}

export async function handleCollectiveOrderSlotWayForPayWebhook(
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
    logger.info('Collective order slot WFP webhook: already paid', { orderReference })
  }

  const escrowId = extractCollectiveOrderEscrowId(orderReference, payload)
  if (!escrowId) {
    logger.error('Collective order slot WFP webhook: missing escrowId', { orderReference })
    return false
  }

  const result = await collectiveOrderEscrowService.markHeldFromPayment(
    escrowId,
    orderReference,
    payload as Record<string, unknown>,
  )
  if (!result.success) {
    logger.error('Collective order slot WFP webhook: markHeld failed', {
      escrowId,
      orderReference,
      error: result.error,
    })
    return false
  }
  logger.info('Collective order slot WFP webhook: held', { escrowId, orderReference })
  return true
}

export async function handleCollectiveOrderSlotStripeWebhook(
  event: { type: string; data: { object: Record<string, unknown> } },
): Promise<boolean> {
  if (event.type !== 'checkout.session.completed') {
    return false
  }

  const session = event.data.object
  const metadata = (session.metadata ?? {}) as Record<string, string>
  if (metadata.purpose !== 'collective_order_slot') {
    return false
  }

  const orderReference = metadata.orderReference || String(session.id ?? '')
  const escrowId = metadata.entityId || metadata.collectiveOrderEscrowId
  if (!escrowId) {
    logger.error('Collective order slot Stripe webhook: missing entityId', { metadata })
    return false
  }

  await paymentTransactionService.markPaid(orderReference, metadata)

  const result = await collectiveOrderEscrowService.markHeldFromPayment(
    escrowId,
    orderReference,
    metadata,
  )
  if (!result.success) {
    logger.error('Collective order slot Stripe webhook: markHeld failed', {
      escrowId,
      orderReference,
      error: result.error,
    })
    return false
  }
  logger.info('Collective order slot Stripe webhook: held', { escrowId, orderReference })
  return true
}
