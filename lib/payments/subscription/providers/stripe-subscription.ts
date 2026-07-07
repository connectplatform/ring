/**
 * Stripe Subscription Provider — Stripe Subscriptions API integration.
 *
 * Handles recurring membership billing via Stripe:
 *   1. Creates Stripe Customer (idempotent — searches by ring_user_id metadata)
 *   2. Creates Stripe Price (recurring monthly interval)
 *   3. Creates Stripe Subscription (auto-charges monthly)
 *   4. Stores stripe_customer_id + stripe_subscription_id in subscription_ledger
 *
 * Webhook handlers (Phase S3):
 *   - invoice.payment_succeeded → extend next_payment_due
 *   - invoice.payment_failed → increment failed_attempts
 *   - customer.subscription.deleted → mark cancelled
 *
 * Cancellation: stripe.subscriptions.cancel() — cancels at period end
 */

import 'server-only'

import { logger } from '@/lib/logger'
import {
  ensureStripeCustomer,
  createStripeMembershipPrice,
  createStripeSubscription,
  cancelStripeSubscription,
} from '@/lib/payments/processors/stripe-subscription-api'
import type {
  SubscriptionProviderModule,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  CancelSubscriptionResult,
  RenewSubscriptionResult,
} from '@/lib/payments/subscription/subscription-types'

export const stripeSubscriptionProvider: SubscriptionProviderModule = {
  provider: 'stripe',

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    try {
      // 1. Ensure Stripe Customer exists
      const { customerId } = await ensureStripeCustomer({
        email: input.userEmail,
        userId: input.userId,
      })

      // 2. Create Stripe Price for the membership tier
      const productName = 'Ring Platform Membership (Monthly)'
      const { priceId } = await createStripeMembershipPrice({
        unitAmount: input.amount,
        currency: input.currency.toLowerCase(),
        productName,
        metadata: {
          ring_user_id: input.userId,
          purpose: 'membership_upgrade',
        },
      })

      // 3. Create Stripe Subscription
      const orderReference = `sub_${Date.now()}_${input.userId.slice(-8)}`
      const result = await createStripeSubscription({
        customerId,
        priceId,
        orderReference,
        purpose: 'membership_upgrade',
        userId: input.userId,
      })

      if (!result.success) {
        return { success: false, error: result.error ?? 'Stripe subscription creation failed' }
      }

      logger.info('Stripe subscription created', {
        userId: input.userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: result.subscriptionId,
      })

      return {
        success: true,
        gatewayReference: result.subscriptionId,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Stripe createSubscription failed', { userId: input.userId, error: message })
      return { success: false, error: message }
    }
  },

  async cancelSubscription(
    userId: string,
    gatewayReference?: string,
  ): Promise<CancelSubscriptionResult> {
    if (!gatewayReference) {
      return { success: false, error: 'Missing stripe_subscription_id' }
    }
    try {
      const cancelled = await cancelStripeSubscription(gatewayReference)
      if (!cancelled) {
        return { success: false, error: 'Stripe cancellation failed' }
      }
      logger.info('Stripe subscription cancelled', { userId, stripeSubscriptionId: gatewayReference })
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Stripe cancelSubscription failed', { userId, error: message })
      return { success: false, error: message }
    }
  },

  async renewSubscription(
    userId: string,
    gatewayReference?: string,
  ): Promise<RenewSubscriptionResult> {
    // Stripe subscriptions auto-renew — manual renewal is not needed.
    // The cron (Phase S4) will check subscription_ledger for due payments
    // and handle failures via invoice.payment_failed webhooks.
    return { success: false, error: 'Stripe subscriptions auto-renew via invoice billing' }
  },
}
