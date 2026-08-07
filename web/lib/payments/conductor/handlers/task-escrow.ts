import 'server-only'

import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { parseOrderReference } from '@/lib/payments/order-reference'
import { taskEscrowService } from '@/features/tasks/services/task-escrow-service'
import { logger } from '@/lib/logger'

function extractTaskEscrowId(
  orderReference: string,
  payload?: Record<string, unknown>,
): string | null {
  const fromMeta = payload?.taskEscrowId ?? payload?.entityId
  if (typeof fromMeta === 'string' && fromMeta) return fromMeta

  const parsed = parseOrderReference(orderReference)
  if (parsed?.purpose === 'task_escrow' && parsed.entityId) {
    return parsed.entityId
  }
  return null
}

/**
 * WayForPay webhook → mark task escrow held (idempotent).
 */
export async function handleTaskEscrowWayForPayWebhook(
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
    logger.info('Task escrow WFP webhook: already paid', { orderReference })
    return true
  }

  const escrowId = extractTaskEscrowId(orderReference, payload)
  if (!escrowId) {
    logger.error('Task escrow WFP webhook: missing escrowId', { orderReference })
    return false
  }

  await taskEscrowService.markHeldFromPayment(
    escrowId,
    orderReference,
    payload as Record<string, unknown>,
  )
  logger.info('Task escrow WFP webhook: held', { escrowId, orderReference })
  return true
}

/**
 * Stripe checkout.session.completed → mark task escrow held.
 */
export async function handleTaskEscrowStripeWebhook(
  event: { type: string; data: { object: Record<string, unknown> } },
): Promise<boolean> {
  if (event.type !== 'checkout.session.completed') {
    return false
  }

  const session = event.data.object
  const metadata = (session.metadata ?? {}) as Record<string, string>
  if (metadata.purpose !== 'task_escrow') {
    return false
  }

  const orderReference = metadata.orderReference || String(session.id ?? '')
  const escrowId = metadata.entityId || metadata.taskEscrowId
  if (!escrowId) {
    logger.error('Task escrow Stripe webhook: missing entityId', { metadata })
    return false
  }

  const isNew = await paymentTransactionService.markPaid(orderReference, metadata)
  if (!isNew) return true

  await taskEscrowService.markHeldFromPayment(escrowId, orderReference, metadata)
  logger.info('Task escrow Stripe webhook: held', { escrowId, orderReference })
  return true
}
