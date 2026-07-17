import 'server-only'

import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { parseOrderReference } from '@/lib/payments/order-reference'
import { ProjectOrderService } from '@/features/crm/orders/project-order-service'
import { notifyProjectOrderPaid } from '@/features/crm/orders/notify'
import { logger } from '@/lib/logger'

function extractProjectOrderId(
  orderReference: string,
  payload?: Record<string, unknown>,
): string | null {
  const fromMeta = payload?.projectOrderId ?? payload?.entityId
  if (typeof fromMeta === 'string' && fromMeta) return fromMeta

  const parsed = parseOrderReference(orderReference)
  if (parsed?.purpose === 'project_order' && parsed.entityId) {
    return parsed.entityId
  }
  return null
}

/**
 * WayForPay webhook → mark CRM project order paid (idempotent).
 */
export async function handleProjectOrderWayForPayWebhook(
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
    logger.info('Project order WFP webhook: already paid', { orderReference })
    return true
  }

  const projectOrderId = extractProjectOrderId(orderReference, payload)
  if (!projectOrderId) {
    logger.error('Project order WFP webhook: missing projectOrderId', { orderReference })
    return false
  }

  await ProjectOrderService.markPaid(projectOrderId, orderReference)
  const order = await ProjectOrderService.getById(projectOrderId)
  if (order) {
    void notifyProjectOrderPaid({ orderId: projectOrderId, buyerUserId: order.userId })
  }
  logger.info('Project order WFP webhook: paid', { projectOrderId, orderReference })
  return true
}

/**
 * Stripe checkout.session.completed → mark CRM project order paid.
 */
export async function handleProjectOrderStripeWebhook(
  event: { type: string; data: { object: Record<string, unknown> } },
): Promise<boolean> {
  if (event.type !== 'checkout.session.completed') {
    return false
  }

  const session = event.data.object
  const metadata = (session.metadata ?? {}) as Record<string, string>
  if (metadata.purpose !== 'project_order') {
    return false
  }

  const orderReference = metadata.orderReference || String(session.id ?? '')
  const projectOrderId = metadata.entityId || metadata.projectOrderId
  if (!projectOrderId) {
    logger.error('Project order Stripe webhook: missing entityId', { metadata })
    return false
  }

  const isNew = await paymentTransactionService.markPaid(orderReference, metadata)
  if (!isNew) return true

  await ProjectOrderService.markPaid(projectOrderId, orderReference)
  const order = await ProjectOrderService.getById(projectOrderId)
  if (order) {
    void notifyProjectOrderPaid({ orderId: projectOrderId, buyerUserId: order.userId })
  }
  logger.info('Project order Stripe webhook: paid', { projectOrderId, orderReference })
  return true
}
