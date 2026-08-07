/**
 * Stripe store-order webhook adapter.
 *
 * Handles `checkout.session.completed` for `metadata.purpose === 'store_order'`;
 * payload translation only — fulfillment lives in `fulfillStoreOrderPaid`.
 */

import { logger } from '@/lib/logger'
import { fulfillStoreOrderPaid } from '@/lib/payments/conductor/fulfill-store-order-paid'
import { getMainCurrencySymbol } from '@/lib/ring-config-core'

export async function handleStoreStripeWebhook(event: {
  type: string
  data: { object: Record<string, unknown> }
}): Promise<{ success: boolean; orderId?: string }> {
  if (event.type !== 'checkout.session.completed') {
    return { success: false }
  }

  const session = event.data.object as Record<string, unknown>
  const metadata = (session.metadata ?? {}) as Record<string, string>
  const orderReference = String(metadata.orderReference ?? '')
  const orderId = String(metadata.entityId ?? '')

  if (!orderReference || !orderId) {
    logger.error('Stripe store webhook: missing metadata', {
      sessionId: session.id,
      metadata,
    })
    return { success: false }
  }

  return fulfillStoreOrderPaid({
    orderId,
    orderReference,
    amount: typeof session.amount_total === 'number' ? session.amount_total / 100 : 0,
    currency: String(session.currency ?? getMainCurrencySymbol()),
    rail: 'card',
    processor: 'stripe',
    processorPayload: session,
    paymentDetails: { stripeSessionId: String(session.id ?? '') },
    source: 'Stripe store',
  })
}
