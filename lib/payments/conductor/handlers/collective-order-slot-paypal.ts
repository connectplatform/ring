import 'server-only'

import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { parseOrderReference } from '@/lib/payments/order-reference'
import { collectiveOrderEscrowService } from '@/features/opportunities/services/collective-order-escrow-service'
import { logger } from '@/lib/logger'

/**
 * PayPal CAPTURE.COMPLETED → mark collective-order slot held (idempotent).
 */
export async function handleCollectiveOrderSlotPayPalCapture(opts: {
  orderReference: string
  processorPayload: Record<string, unknown>
}): Promise<boolean> {
  const { orderReference, processorPayload } = opts
  if (!orderReference) {
    logger.error('PayPal collective order slot: missing orderReference')
    return false
  }

  const isNew = await paymentTransactionService.markPaid(orderReference, processorPayload)
  if (!isNew) {
    logger.info('PayPal collective order slot: already paid', { orderReference })
  }

  const fromMeta =
    processorPayload.collectiveOrderEscrowId ??
    (processorPayload.resource as Record<string, unknown> | undefined)?.custom_id
  let escrowId =
    typeof fromMeta === 'string' && fromMeta
      ? fromMeta
      : parseOrderReference(orderReference)?.entityId ?? null

  // Prefer ledger entity id when available
  const tx = await paymentTransactionService.findByOrderReference(orderReference)
  if (tx?.entity_id) escrowId = String(tx.entity_id)

  if (!escrowId) {
    logger.error('PayPal collective order slot: missing escrowId', { orderReference })
    return false
  }

  const result = await collectiveOrderEscrowService.markHeldFromPayment(
    escrowId,
    orderReference,
    { ...processorPayload, rail: 'paypal' },
  )
  if (!result.success) {
    logger.error('PayPal collective order slot: markHeld failed', {
      escrowId,
      orderReference,
      error: result.error,
    })
    return false
  }

  logger.info('PayPal collective order slot: held', { escrowId, orderReference })
  return true
}
