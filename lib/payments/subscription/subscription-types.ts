/**
 * Subscription Types — shared contracts for the SubscriptionConductor.
 *
 * All providers implement `SubscriptionProviderModule` with provider-specific
 * create/cancel/renew logic.  The conductor routes via `provider` field.
 */

import type { SubscriptionProvider } from '@/lib/payments/subscription/subscription-ledger-schema'

// ---------------------------------------------------------------------------
// Shared result types
// ---------------------------------------------------------------------------

export interface CreateSubscriptionInput {
  userId: string
  userEmail: string
  provider: SubscriptionProvider
  /** Monthly fee in the gateway's minor units (cents for fiat, raw for crypto). */
  amount: number
  currency: string
  /** Gateway fee percent for net-revenue calculation. */
  gatewayFeePercent: number
  /** Optional fixed gateway fee in minor units. */
  gatewayFeeFixed?: number
  /** Human-readable gateway label. */
  gateway: string
  /** Payment method category. */
  method: 'card' | 'credit_balance' | 'crypto' | 'paypal' | 'nft'
  /** User's wallet address (required for crypto). */
  walletAddress?: string
  /** Language preference for checkout. */
  locale?: string
  /** Return URL after external checkout redirect. */
  returnUrl?: string
  /** Gateway-specific metadata. */
  metadata?: Record<string, unknown>
}

export interface CreateSubscriptionResult {
  success: boolean
  subscriptionId?: string
  /** Gateway-specific reference (stripe_subscription_id, wayforpay_rec_token, etc.). */
  gatewayReference?: string
  /** Redirect URL for external checkout (Stripe/WayForPay hosted page). */
  redirectUrl?: string
  /** On-chain transaction signature. */
  txSignature?: string
  error?: string
}

export interface CancelSubscriptionResult {
  success: boolean
  error?: string
}

export interface RenewSubscriptionResult {
  success: boolean
  nextPaymentDue?: number
  txSignature?: string
  error?: string
}

// ---------------------------------------------------------------------------
// Provider module contract — every provider implements this
// ---------------------------------------------------------------------------

export interface SubscriptionProviderModule {
  readonly provider: SubscriptionProvider

  /** Create a new subscription (one-time payment + recurring setup). */
  createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult>

  /** Cancel an active subscription. */
  cancelSubscription(
    userId: string,
    gatewayReference?: string,
  ): Promise<CancelSubscriptionResult>

  /** Manually renew a subscription. */
  renewSubscription(
    userId: string,
    gatewayReference?: string,
  ): Promise<RenewSubscriptionResult>
}
