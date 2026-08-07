import { parseOrderReference } from '@/lib/payments/order-reference'
import { getPayPalGatewayCurrency } from '@/lib/payments/processors/paypal-client'
import {
  verifyWayForPayGenericWebhook,
  verifyWayForPayStoreWebhook,
  buildMembershipWebhookAck,
} from '@/lib/payments/processors/wayforpay-verify'
import { handleStoreWayForPayWebhook } from '@/lib/payments/conductor/handlers/store-order'
import { handleMembershipWayForPayWebhook } from '@/lib/payments/conductor/handlers/membership-upgrade'
import { handleNewsWayForPayWebhook } from '@/lib/payments/conductor/handlers/news-promotion'
import { handleWalletTopupWayForPayWebhook } from '@/lib/payments/conductor/handlers/wallet-topup'
import { handleWalletTopupStripeWebhook } from '@/lib/payments/conductor/handlers/wallet-topup-stripe'
import { handleNativeTokenOnrampWayForPayWebhook } from '@/lib/payments/conductor/handlers/native-token-onramp'
import { handleNativeTokenOnrampStripeWebhook } from '@/lib/payments/conductor/handlers/native-token-onramp-stripe'
import {
  handleProjectOrderWayForPayWebhook,
  handleProjectOrderStripeWebhook,
} from '@/lib/payments/conductor/handlers/project-order'
import {
  handleTaskEscrowWayForPayWebhook,
  handleTaskEscrowStripeWebhook,
} from '@/lib/payments/conductor/handlers/task-escrow'
import {
  handleCollectiveOrderSlotWayForPayWebhook,
  handleCollectiveOrderSlotStripeWebhook,
} from '@/lib/payments/conductor/handlers/collective-order-slot'
import {
  handlePublicPoolContributionWayForPayWebhook,
  handlePublicPoolContributionStripeWebhook,
} from '@/lib/payments/conductor/handlers/public-pool-contribution'
import { handleCollectiveOrderSlotPayPalCapture } from '@/lib/payments/conductor/handlers/collective-order-slot-paypal'
import { verifyStripeWebhook } from '@/lib/payments/processors/stripe.processor'
import { handleNewsStripeWebhook } from '@/lib/payments/conductor/handlers/news-promotion'
import { handleMembershipStripeWebhook } from '@/lib/payments/conductor/handlers/membership-upgrade-stripe'
import { handleStoreStripeWebhook } from '@/lib/payments/conductor/handlers/store-order-stripe'
import { handleStorePayPalCapture } from '@/lib/payments/conductor/handlers/store-order-paypal'
import { handleMembershipPayPalCapture } from '@/lib/payments/conductor/handlers/membership-upgrade-paypal'
import { handleWalletTopupPayPalCapture } from '@/lib/payments/conductor/handlers/wallet-topup-paypal'
import { handleNewsPayPalCapture } from '@/lib/payments/conductor/handlers/news-promotion-paypal'
import {
  handlePayPalSubscriptionActivated,
  handlePayPalSubscriptionSaleCompleted,
  handlePayPalSubscriptionTerminal,
} from '@/lib/payments/conductor/handlers/membership-paypal-subscription'
import { verifyPayPalWebhook } from '@/lib/payments/processors/paypal-client'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { logger } from '@/lib/logger'
import type { WebhookHandleResult, PaymentPurpose } from '@/lib/payments/conductor/types'
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

  if (parsed.purpose === 'wallet_topup') {
    const processed = await handleWalletTopupWayForPayWebhook(payload)
    return { success: processed, purpose: 'wallet_topup' }
  }

  if (parsed.purpose === 'native_token_onramp') {
    const processed = await handleNativeTokenOnrampWayForPayWebhook(payload)
    return { success: processed, purpose: 'native_token_onramp' }
  }

  if (parsed.purpose === 'project_order') {
    const processed = await handleProjectOrderWayForPayWebhook(payload)
    return { success: processed, purpose: 'project_order' }
  }

  if (parsed.purpose === 'task_escrow') {
    const processed = await handleTaskEscrowWayForPayWebhook(payload)
    return { success: processed, purpose: 'task_escrow' }
  }

  if (parsed.purpose === 'collective_order_slot') {
    const processed = await handleCollectiveOrderSlotWayForPayWebhook(payload)
    return { success: processed, purpose: 'collective_order_slot' }
  }

  if (parsed.purpose === 'public_pool_contribution') {
    const processed = await handlePublicPoolContributionWayForPayWebhook(payload)
    return { success: processed, purpose: 'public_pool_contribution' }
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

  const session = event.data.object as Record<string, unknown>
  const metadata = (session.metadata ?? {}) as Record<string, string>
  const purpose = metadata.purpose as PaymentPurpose | undefined

  logger.info('Stripe webhook received', {
    type: event.type,
    purpose,
    metadata,
  })

  // Route by metadata.purpose — mirrors WayForPay orderReference dispatch
  switch (purpose) {
    case 'store_order': {
      const result = await handleStoreStripeWebhook(event)
      return { success: result.success, purpose: 'store_order' }
    }

    case 'membership_upgrade': {
      const processed = await handleMembershipStripeWebhook(event)
      return {
        success: processed,
        purpose: 'membership_upgrade',
      }
    }

    case 'wallet_topup': {
      const processed = await handleWalletTopupStripeWebhook(event)
      return { success: processed, purpose: 'wallet_topup' }
    }

    case 'native_token_onramp': {
      const processed = await handleNativeTokenOnrampStripeWebhook(event)
      return { success: processed, purpose: 'native_token_onramp' }
    }

    case 'project_order': {
      const processed = await handleProjectOrderStripeWebhook(event)
      return { success: processed, purpose: 'project_order' }
    }

    case 'task_escrow': {
      const processed = await handleTaskEscrowStripeWebhook(event)
      return { success: processed, purpose: 'task_escrow' }
    }

    case 'collective_order_slot': {
      const processed = await handleCollectiveOrderSlotStripeWebhook(event)
      return { success: processed, purpose: 'collective_order_slot' }
    }

    case 'public_pool_contribution': {
      if (event.type !== 'checkout.session.completed') {
        return { success: true, purpose: 'public_pool_contribution' }
      }
      const processed = await handlePublicPoolContributionStripeWebhook(session)
      return { success: processed, purpose: 'public_pool_contribution' }
    }

    case 'scheduled_service_slot': {
      logger.warn('Stripe webhook: scheduled_service_slot not implemented yet', {
        type: event.type,
        metadata,
      })
      return { success: false, purpose: 'scheduled_service_slot', error: 'Not implemented' }
    }

    case 'news_promotion':
    default: {
      // Legacy: also handle checkout.session.completed without explicit purpose
      if (event.type === 'checkout.session.completed' || purpose === 'news_promotion') {
        const processed = await handleNewsStripeWebhook(event)
        return { success: processed, purpose: purpose || 'news_promotion' }
      }
      break
    }
  }

  logger.warn('Stripe webhook: unhandled event', {
    type: event.type,
    purpose,
    metadata,
  })
  return { success: true }
}

function extractPayPalOrderReference(event: Record<string, unknown>): string {
  const resource = (event.resource ?? {}) as Record<string, unknown>
  const customId = String(resource.custom_id ?? '')
  if (customId) return customId

  const purchaseUnits = resource.purchase_units as Array<Record<string, unknown>> | undefined
  if (Array.isArray(purchaseUnits) && purchaseUnits[0]) {
    const fromUnit = String(purchaseUnits[0].custom_id ?? '')
    if (fromUnit) return fromUnit
  }

  const supplementary = resource.supplementary_data as Record<string, unknown> | undefined
  const related = supplementary?.related_ids as Record<string, unknown> | undefined
  return String(related?.order_id ?? resource.invoice_id ?? '')
}

function extractPayPalCaptureAmount(event: Record<string, unknown>): {
  amount: number
  currency: string
} {
  const resource = (event.resource ?? {}) as Record<string, unknown>
  const amountObj = (resource.amount ?? {}) as Record<string, unknown>
  const value = Number(amountObj.value ?? 0)
  const currency = String(amountObj.currency_code ?? getPayPalGatewayCurrency()).toUpperCase()
  return { amount: Number.isFinite(value) ? value : 0, currency }
}

/**
 * Dispatch verified PayPal webhook events to purpose handlers.
 * Prefer PAYMENT.CAPTURE.COMPLETED for Orders v2 fulfillment.
 */
export async function dispatchPayPalWebhook(
  rawBody: string,
  headers: {
    transmissionId: string
    transmissionTime: string
    transmissionSig: string
    certUrl: string
    authAlgo: string
  },
): Promise<WebhookHandleResult> {
  const verified = await verifyPayPalWebhook(rawBody, headers)
  if (!verified) {
    return { success: false, error: 'Invalid PayPal signature' }
  }

  let event: Record<string, unknown>
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return { success: false, error: 'Invalid PayPal JSON' }
  }

  const eventType = String(event.event_type ?? '')
  logger.info('PayPal webhook received', { eventType })

  // Subscriptions v1 lifecycle — dedicated handlers (resource shape ≠ Orders capture)
  if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED') {
    const ok = await handlePayPalSubscriptionActivated(event)
    return { success: ok, purpose: 'membership_upgrade' }
  }
  if (eventType === 'PAYMENT.SALE.COMPLETED') {
    const ok = await handlePayPalSubscriptionSaleCompleted(event)
    return { success: ok, purpose: 'membership_upgrade' }
  }
  if (
    eventType === 'BILLING.SUBSCRIPTION.CANCELLED' ||
    eventType === 'BILLING.SUBSCRIPTION.SUSPENDED' ||
    eventType === 'BILLING.SUBSCRIPTION.EXPIRED' ||
    eventType === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED'
  ) {
    const ok = await handlePayPalSubscriptionTerminal(event, eventType)
    return { success: ok, purpose: 'membership_upgrade' }
  }

  if (
    eventType !== 'PAYMENT.CAPTURE.COMPLETED' &&
    eventType !== 'CHECKOUT.ORDER.APPROVED'
  ) {
    // Ack non-fulfillment events (DENIED/REFUNDED can be handled later)
    return { success: true }
  }

  // CAPTURE.COMPLETED is the fulfillment source of truth for Orders v2
  if (eventType === 'CHECKOUT.ORDER.APPROVED') {
    return { success: true }
  }

  let orderReference = extractPayPalOrderReference(event)
  if (!orderReference && eventType === 'PAYMENT.CAPTURE.COMPLETED') {
    // Some capture payloads nest custom_id under supplementary_data only — already tried
    orderReference = String((event.resource as Record<string, unknown>)?.invoice_id ?? '')
  }

  if (!orderReference) {
    logger.error('PayPal webhook: missing orderReference/custom_id', { eventType })
    return { success: false, error: 'Missing orderReference' }
  }

  const tx = await paymentTransactionService.findByOrderReference(orderReference)
  const purpose = (tx?.purpose ?? parsePurposeFromReference(orderReference)) as PaymentPurpose | undefined
  const { amount, currency } = extractPayPalCaptureAmount(event)
  const paidAmount =
    amount > 0 ? amount : typeof tx?.amount_minor === 'number' ? tx.amount_minor / 100 : 0
  const paidCurrency = currency || tx?.currency?.toUpperCase() || getPayPalGatewayCurrency()

  switch (purpose) {
    case 'store_order': {
      const orderId = String(tx?.entity_id ?? '')
      const result = await handleStorePayPalCapture({
        orderReference,
        orderId,
        amount: paidAmount,
        currency: paidCurrency,
        processorPayload: event,
      })
      return { success: result.success, purpose: 'store_order' }
    }
    case 'membership_upgrade': {
      const processed = await handleMembershipPayPalCapture({
        orderReference,
        userId: String(tx?.user_id ?? ''),
        userEmail: '',
        amount: paidAmount,
        currency: paidCurrency,
        processorPayload: event,
      })
      return { success: processed, purpose: 'membership_upgrade' }
    }
    case 'wallet_topup': {
      const processed = await handleWalletTopupPayPalCapture({
        orderReference,
        amount: paidAmount,
        processorPayload: event,
      })
      return { success: processed, purpose: 'wallet_topup' }
    }
    case 'news_promotion': {
      const processed = await handleNewsPayPalCapture({
        orderReference,
        processorPayload: event,
      })
      return { success: processed, purpose: 'news_promotion' }
    }
    case 'collective_order_slot': {
      const processed = await handleCollectiveOrderSlotPayPalCapture({
        orderReference,
        processorPayload: event,
      })
      return { success: processed, purpose: 'collective_order_slot' }
    }
    case 'scheduled_service_slot':
    case 'task_escrow': {
      // Explicit no-op: PayPal capture not wired for these purposes yet (avoid silent ack)
      logger.warn('PayPal webhook: purpose not implemented for capture fulfillment', {
        purpose,
        orderReference,
        eventType,
      })
      return { success: false, error: `PayPal fulfillment not implemented for ${purpose}` }
    }
    default:
      logger.warn('PayPal webhook: unhandled purpose', { purpose, orderReference, eventType })
      return { success: true }
  }
}

function parsePurposeFromReference(orderReference: string): PaymentPurpose | undefined {
  if (orderReference.startsWith('store_')) return 'store_order'
  if (orderReference.startsWith('membership_')) return 'membership_upgrade'
  if (orderReference.startsWith('project_')) return 'project_order'
  if (orderReference.startsWith('task_')) return 'task_escrow'
  if (orderReference.startsWith('coslot_')) return 'collective_order_slot'
  if (orderReference.startsWith('ssslot_')) return 'scheduled_service_slot'
  if (orderReference.startsWith('wallet_') || orderReference.startsWith('topup_') || orderReference.startsWith('wallettopup_')) {
    return 'wallet_topup'
  }
  if (orderReference.startsWith('news-promo-') || orderReference.startsWith('news_')) {
    return 'news_promotion'
  }
  if (orderReference.startsWith('tokenonramp_')) return 'native_token_onramp'
  return undefined
}
