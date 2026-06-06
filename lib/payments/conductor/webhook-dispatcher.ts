import { parseOrderReference } from '@/lib/payments/order-reference'
import {
  verifyWayForPayGenericWebhook,
  verifyWayForPayStoreWebhook,
  buildMembershipWebhookAck,
} from '@/lib/payments/processors/wayforpay-verify'
import { handleStoreWayForPayWebhook } from '@/lib/payments/conductor/handlers/store-order'
import { handleMembershipWayForPayWebhook } from '@/lib/payments/conductor/handlers/membership-upgrade'
import { handleNewsWayForPayWebhook } from '@/lib/payments/conductor/handlers/news-promotion'
import { verifyStripeWebhook } from '@/lib/payments/processors/stripe.processor'
import { handleNewsStripeWebhook } from '@/lib/payments/conductor/handlers/news-promotion'
import { logger } from '@/lib/logger'
import type { WebhookHandleResult } from '@/lib/payments/conductor/types'
import type { StoreWebhookPayload } from '@/lib/payments/wayforpay-store-service'

export async function dispatchWayForPayWebhook(
  payload: Record<string, unknown>
): Promise<WebhookHandleResult> {
  const orderReference = String(payload.orderReference ?? '')
  const parsed = parseOrderReference(orderReference)

  if (!parsed) {
    logger.error('WFP webhook: unknown order reference', { orderReference })
    return { success: false, error: 'Unknown order reference' }
  }

  if (parsed.purpose === 'store_order') {
    if (!verifyWayForPayStoreWebhook(payload as StoreWebhookPayload)) {
      return { success: false, error: 'Invalid signature' }
    }
    const result = await handleStoreWayForPayWebhook(payload as StoreWebhookPayload)
    return { success: result.success, purpose: 'store_order' }
  }

  if (!verifyWayForPayGenericWebhook(payload)) {
    return { success: false, error: 'Invalid signature' }
  }

  if (parsed.purpose === 'membership_upgrade') {
    const processed = await handleMembershipWayForPayWebhook(payload)
    if (processed) {
      return {
        success: true,
        purpose: 'membership_upgrade',
        membershipAck: buildMembershipWebhookAck(orderReference),
      }
    }
    return { success: false, purpose: 'membership_upgrade' }
  }

  if (parsed.purpose === 'news_promotion') {
    const processed = await handleNewsWayForPayWebhook(payload)
    return { success: processed, purpose: 'news_promotion' }
  }

  return { success: false, error: 'Unhandled purpose' }
}

export async function dispatchStripeWebhook(
  rawBody: string,
  signature: string
): Promise<WebhookHandleResult> {
  const event = await verifyStripeWebhook(rawBody, signature)
  if (!event) {
    return { success: false, error: 'Invalid Stripe signature' }
  }

  const metadata = (event.data.object.metadata ?? {}) as Record<string, string>
  const purpose = metadata.purpose || 'news_promotion'

  if (purpose === 'news_promotion' || event.type === 'checkout.session.completed') {
    const processed = await handleNewsStripeWebhook(event)
    return { success: processed, purpose: 'news_promotion' }
  }

  return { success: true }
}
