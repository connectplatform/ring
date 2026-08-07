/**
 * Stripe Membership Upgrade Webhook Handler.
 *
 * Handles `checkout.session.completed` events for `metadata.purpose === 'membership_upgrade'`.
 * Upgrades user role to MEMBER, triggers referral reward processing, and creates
 * a subscription_ledger row via SubscriptionConductor.
 *
 * Mirrors `handleMembershipWayForPayWebhook` but reads from Stripe metadata
 * instead of WayForPay payload fields.
 */

import { UserRolesArray, resolveSessionUserRole } from '@/features/auth/user-role'
import { processSuccessfulPayment } from '@/lib/payments/wayforpay-service'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { ReferralRewardService } from '@/features/refcodes/services/referral-reward-service'
import { SubscriptionConductor } from '@/lib/payments/subscription/subscription-conductor'
import { getGatewayConfig } from '@/lib/payments/subscription/subscription-config'
import { logger } from '@/lib/logger'

/**
 * Handles Stripe webhook for a completed checkout session with membership upgrade purpose. 
 * Performs the following:
 *   - Validates event type and required metadata
 *   - Checks idempotency to avoid double processing
 *   - Processes successful payment to upgrade user to MEMBER
 *   - Triggers referral reward if applicable
 *   - Records subscription in subscription ledger
 * Returns whether processing and upgrade were successful.
 * 
 * // TODO: If adopted in new React Server Actions (Next.js 14+/16+), this handler could be moved to an API Route
 *  using the app/ directory native handlers for webhooks, which would allow improved routing/security (`POST /api/webhooks/stripe`)
 */
export async function handleMembershipStripeWebhook(event: {
  type: string
  data: { object: Record<string, unknown> }
}): Promise<boolean> {

  // Ensure the incoming webhook is the Stripe session completion event
  if (event.type !== 'checkout.session.completed') {
    // Event type is not handled by this webhook
    return false
  }

  // Extract session data and payment metadata from Stripe event
  const session = event.data.object as Record<string, unknown>
  // Using nullish coalescing in case metadata is undefined; enforce string map
  const metadata = (session.metadata ?? {}) as Record<string, string>
  // These keys should ALWAYS be in the session metadata for a membership upgrade
  const orderReference = String(metadata.orderReference ?? '')
  const userId = String(metadata.ring_user_id ?? metadata.userId ?? '')
  const userEmail = String(session.customer_email ?? metadata.userEmail ?? '')

  // Validate presence of required identifiers (order and user)
  if (!orderReference || !userId) {
    logger.error('Stripe membership webhook: missing metadata', {
      sessionId: session.id,
      metadata,
    })
    return false
  }

  // Check idempotency. If this orderReference has already been paid, we skip double processing.
  // markPaid should atomically mark paid on first call (returns true), false if previously called.
  const isNew = await paymentTransactionService.markPaid(
    orderReference,
    session as Record<string, unknown>,
  )
  if (!isNew) {
    logger.info('Stripe membership webhook: already paid', { orderReference })
    // Processing already happened, consider this a success for idempotency.
    return true
  }

  // Calculate paid amount (Stripe reports cents; convert to major units)
  const amount = typeof session.amount_total === 'number'
    ? session.amount_total / 100
    : 0
  // Default to USD if missing, and normalize case
  const currency = String(session.currency ?? 'usd').toUpperCase()

  // Process payment--upgrade user membership.
  // This uses existing logic for handling payments (also used by WayForPay path).
  // The legacy processSuccessfulPayment expects a uniform interface.
  const processed = await processSuccessfulPayment({
    userId,
    targetRole: resolveSessionUserRole(UserRolesArray.member),
    paymentData: {
      orderReference,
      amount,
      currency,
      provider: 'stripe',
      stripeSessionId: String(session.id ?? ''),
    },
  } as any)
  // TODO: Refactor processSuccessfulPayment in future to be type-safe (remove 'as any') and split provider-specific logic.

  if (processed) {
    // On successful member upgrade, handle referral rewards if applicable
    try {
      await ReferralRewardService.onMembershipPaid({
        userId,
        orderReference,
        amount,
        currency,
      })
    } catch (referralError) {
      logger.error('Stripe membership: referral reward failed', {
        orderReference,
        userId,
        error: referralError,
      })
      // Not fatal—continue; the main membership upgrade has succeeded
    }

    // Record subscription in subscription_ledger — NEW in Phase S6
    try {
      // Get Stripe gateway config (fees, settings)
      const gwConfig = getGatewayConfig('stripe')

      await SubscriptionConductor.createSubscription({
        userId,
        userEmail,
        provider: 'stripe',
        gateway: 'Stripe',
        method: 'card',
        amount,
        currency,
        gatewayFeePercent: gwConfig?.feePercent ?? 2.9,
        gatewayFeeFixed: gwConfig?.feeFixedCents ?? 0.30,
        metadata: {
          source: 'stripe_webhook',
          orderReference,
          sessionId: String(session.id ?? ''),
          stripeSubscriptionId: String(metadata.stripeSubscriptionId ?? ''),
        },
      })

      logger.info('Stripe membership webhook: subscription_ledger row created', {
        userId,
        orderReference,
        amount,
        currency,
      })
    } catch (ledgerError) {
      logger.error('Stripe membership webhook: subscription_ledger create failed', {
        orderReference,
        ledgerError,
      })
      // Not fatal; membership is upgraded, but ledger entry failed
    }

    logger.info('Stripe membership upgrade: completed', {
      userId,
      orderReference,
      amount,
      currency,
    })
  }

  // If the user was upgraded, return true, else false
  // TODO: Use structured return object if detailed status is desirable for upstream
  return processed
}
