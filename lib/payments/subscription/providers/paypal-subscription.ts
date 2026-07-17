/**
 * PayPal Subscription Provider — Subscriptions v1 (recurring) + Orders v2 one-shot.
 *
 * Recurring (`auto_subscribe` / auto_renew): Product → Plan → POST /v1/billing/subscriptions.
 * Stores PayPal subscription.id (I-…) as gatewayReference → paypal_subscription_id.
 * Ledger starts as `pending`; BILLING.SUBSCRIPTION.ACTIVATED promotes to active.
 *
 * One-shot: PaymentConductor Orders v2 (no cancelable PayPal subscription id).
 *
 * @see AI-LEGIOX/legiox-truth-lens/paypal-payment-conductor-processor.nodus.json
 */

import 'server-only'

import { logger } from '@/lib/logger'
import { PaymentConductor } from '@/lib/payments/conductor/payment-conductor'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { buildOrderReference } from '@/lib/payments/order-reference'
import { getGatewayConfig } from '@/lib/payments/subscription/subscription-config'
import {
  cancelPayPalBillingSubscription,
  createPayPalBillingSubscription,
  getPayPalBillingSubscription,
  getPayPalGatewayCurrency,
  isPayPalCredentialsConfigured,
} from '@/lib/payments/processors/paypal-client'
import type {
  SubscriptionProviderModule,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  CancelSubscriptionResult,
  RenewSubscriptionResult,
} from '@/lib/payments/subscription/subscription-types'

function wantsRecurring(input: CreateSubscriptionInput): boolean {
  const meta = input.metadata ?? {}
  if (meta.auto_subscribe === false || meta.auto_renew === false) return false
  if (meta.auto_subscribe === true || meta.auto_renew === true) return true
  // Membership PayPal route defaults auto_subscribe=true
  return true
}

export const paypalSubscriptionProvider: SubscriptionProviderModule = {
  provider: 'paypal',

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    try {
      if (!isPayPalCredentialsConfigured()) {
        return { success: false, error: 'PayPal not configured (PAYPAL_CLIENT_ID / SECRET)' }
      }

      // Webhook must never re-enter PayPal create — use SubscriptionConductor.recordPaidSubscription
      if (String(input.metadata?.source ?? '').includes('webhook')) {
        return {
          success: false,
          error:
            'PayPal provider create must not run from webhook — use recordPaidSubscription / updateSubscriptionStatus',
        }
      }

      const gw = getGatewayConfig('paypal')
      const currency = (input.currency || getPayPalGatewayCurrency()).toUpperCase()
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ring-platform.org'
      const returnUrl =
        input.returnUrl ||
        String(input.metadata?.returnUrl ?? '') ||
        `${baseUrl}/membership/manage?status=paypal_return`
      const cancelUrl =
        String(input.metadata?.cancelUrl ?? '') ||
        `${baseUrl}/membership/manage?status=paypal_cancel`

      if (wantsRecurring(input)) {
        const customId = buildOrderReference('membership_upgrade', { userId: input.userId })

        await paymentTransactionService.createPending({
          purpose: 'membership_upgrade',
          processor: 'paypal',
          rail: 'merchant_redirect',
          orderReference: customId,
          entityType: 'membership_upgrade',
          entityId: input.userId,
          userId: input.userId,
          amountMinor: Math.round(input.amount * 100),
          currency,
        })

        const created = await createPayPalBillingSubscription({
          amount: input.amount,
          currency,
          customId,
          returnUrl,
          cancelUrl,
          userEmail: input.userEmail,
          idempotencyKey: customId,
        })

        logger.info('PayPal Subscriptions v1: subscription created', {
          userId: input.userId,
          paypalSubscriptionId: created.subscriptionId,
          planId: created.planId,
          customId,
          feePercent: gw?.feePercent,
        })

        return {
          success: true,
          subscriptionId: created.subscriptionId,
          gatewayReference: created.subscriptionId,
          ledgerStatus: 'pending',
          redirectUrl: created.approveUrl,
          redirect: { mode: 'navigate', url: created.approveUrl },
        }
      }

      // One-shot membership via Orders v2
      const checkout = await PaymentConductor.createCheckout({
        purpose: 'membership_upgrade',
        rail: 'merchant_redirect',
        userId: input.userId,
        userEmail: input.userEmail,
        entityId: input.userId,
        amount: input.amount,
        currency,
        returnUrl,
        metadata: {
          processor: 'paypal',
          type: 'membership_upgrade',
          auto_subscribe: false,
        },
      })

      if (!checkout.success || !checkout.paymentUrl) {
        return {
          success: false,
          error: checkout.error || 'PayPal checkout failed',
        }
      }

      logger.info('PayPal Orders one-shot: checkout created', {
        userId: input.userId,
        orderReference: checkout.orderReference,
      })

      // Do not insert a cancelable paypal_subscription_id — webhook recordPaidSubscription
      // will write the ledger. Skip conductor insert by returning success without
      // gatewayReference and letting caller use redirect only... Conductor always inserts.
      // For one-shot we still insert pending without paypal id, then CAPTURE activates via
      // recordPaidSubscription which may duplicate — so skip insert: return ledgerStatus
      // pending WITHOUT gatewayReference and amount already tracked in payment_transactions.
      // Simpler: use pending with no gateway ref; Orders CAPTURE uses recordPaidSubscription
      // only if no pending exists, else activates.
      return {
        success: true,
        subscriptionId: checkout.orderReference,
        // No gatewayReference — not a Subscriptions I-… id
        ledgerStatus: 'pending',
        redirectUrl: checkout.paymentUrl,
        redirect: { mode: 'navigate', url: checkout.paymentUrl },
      }
    } catch (error) {
      logger.error('PayPal createSubscription failed', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'PayPal createSubscription failed',
      }
    }
  },

  async cancelSubscription(
    userId: string,
    gatewayReference?: string,
  ): Promise<CancelSubscriptionResult> {
    try {
      if (!gatewayReference) {
        return {
          success: false,
          error: 'Missing paypal_subscription_id (PayPal Subscriptions I-… id required)',
        }
      }
      if (!isPayPalCredentialsConfigured()) {
        return { success: false, error: 'PayPal not configured' }
      }

      await cancelPayPalBillingSubscription(gatewayReference, 'User requested cancellation')
      logger.info('PayPal subscription cancelled', { userId, paypalSubscriptionId: gatewayReference })
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PayPal cancel failed'
      logger.error('PayPal cancelSubscription failed', { userId, error: message })
      return { success: false, error: message }
    }
  },

  async renewSubscription(
    userId: string,
    gatewayReference?: string,
  ): Promise<RenewSubscriptionResult> {
    try {
      if (!gatewayReference) {
        return {
          success: false,
          error: 'Missing paypal_subscription_id for renew status check',
        }
      }
      if (!isPayPalCredentialsConfigured()) {
        return { success: false, error: 'PayPal not configured' }
      }

      const sub = await getPayPalBillingSubscription(gatewayReference)
      const status = String(sub.status ?? '').toUpperCase()
      if (status !== 'ACTIVE') {
        return {
          success: false,
          error: `PayPal subscription status is ${status || 'unknown'} — renewals are webhook-driven (PAYMENT.SALE.COMPLETED)`,
        }
      }

      let nextPaymentDue: number | undefined
      const nextBilling = sub.billing_info?.next_billing_time
      if (nextBilling) {
        const ms = Date.parse(nextBilling)
        if (Number.isFinite(ms)) nextPaymentDue = ms
      }

      logger.info('PayPal renew: status synced from Subscriptions API', {
        userId,
        paypalSubscriptionId: gatewayReference,
        status,
        nextPaymentDue,
      })

      return {
        success: true,
        nextPaymentDue: nextPaymentDue ?? Date.now() + 30 * 24 * 60 * 60 * 1000,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PayPal renew failed'
      logger.error('PayPal renewSubscription failed', { userId, error: message })
      return { success: false, error: message }
    }
  },
}
