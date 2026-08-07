/**
 * Subscription Ledger — SSOT Zod schema for multi-provider membership subscriptions.
 *
 * Replaces the legacy `ring_subscriptions` collection with a provider-agnostic
 * schema that supports Stripe, WayForPay, RING credit-balance, on-chain RING
 * token, NFT gate, and PayPal (future).
 *
 * The `gateway_fee_percent` and `gateway_fee_fixed` enable net-revenue
 * calculation on the admin/subscriptions dashboard without querying the
 * payment gateway directly.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Provider enum — SSOT membership payment providers
// ---------------------------------------------------------------------------

export const SUBSCRIPTION_PROVIDERS = [
  'stripe',
  'wayforpay',
  'credit_balance',
  'native_token',
  'nft_gate',
  'paypal',
  'telegram_stars',
] as const

export const subscriptionProviderSchema = z.enum(SUBSCRIPTION_PROVIDERS)
export type SubscriptionProvider = z.infer<typeof subscriptionProviderSchema>

// ---------------------------------------------------------------------------
// Status enum — mirrors Membership.sol + SubscriptionStatusSchema
// ---------------------------------------------------------------------------

export const SUBSCRIPTION_STATUSES = [
  'pending',
  'active',
  'expired',
  'cancelled',
  'suspended',
  'grace_period',
] as const

export const subscriptionStatusSchema = z.enum(SUBSCRIPTION_STATUSES)
export type SubscriptionLedgerStatus = z.infer<typeof subscriptionStatusSchema>

// ---------------------------------------------------------------------------
// Subscription Ledger row — provider-agnostic SSOT
// ---------------------------------------------------------------------------

export const subscriptionLedgerSchema = z.object({
  id: z.string().min(1),

  // Identity
  user_id: z.string().min(1, 'user_id is required'),

  // Provider & gateway
  provider: subscriptionProviderSchema,
  /** Human-readable gateway label (e.g. "Stripe", "WayForPay", "RING Tokens"). */
  gateway: z.string().min(1),
  /** Payment method: "card", "credit_balance", "crypto", "nft", "paypal" — for UI filtering. */
  method: z.enum(['card', 'credit_balance', 'crypto', 'nft', 'paypal', 'stars']),

  // Status
  status: subscriptionStatusSchema,

  // Financials (minor units — cents for main currency, raw token amount for crypto)
  amount: z.number().min(0),
  /** Transaction currency — main currency code for fiat rails, token symbol for crypto. */
  currency: z.string().min(1),
  /** Gateway fee as percentage (e.g. 2.9). 0 for internal methods. */
  gateway_fee_percent: z.number().min(0).default(0),
  /** Optional fixed fee in gateway's minor units (e.g. 30 for Stripe USD). */
  gateway_fee_fixed: z.number().min(0).default(0),

  // Gateway-specific references (at most one is non-null)
  stripe_subscription_id: z.string().optional(),
  stripe_customer_id: z.string().optional(),
  wayforpay_rec_token: z.string().optional(),
  /** PayPal Subscriptions v1 id (I-…). Not an Orders v2 order id. */
  paypal_subscription_id: z.string().optional(),
  solana_tx_signature: z.string().optional(),
  nft_mint_address: z.string().optional(),
  /**
   * Telegram Stars invoice payload (`stars_<uuid>`) — equals ledger `id` on create.
   * successful_payment.invoice_payload must match this for activation.
   */
  telegram_stars_payload: z.string().optional(),
  /** createInvoiceLink URL returned by Bot API (navigate handoff). */
  telegram_stars_invoice_link: z.string().optional(),
  /** SuccessfulPayment.telegram_payment_charge_id — required for refundStarPayment. */
  telegram_payment_charge_id: z.string().optional(),

  // Timing
  start_time: z.number().int().positive(),
  next_payment_due: z.number().int().positive(),
  /** Payment failures since last successful charge. */
  failed_attempts: z.number().int().min(0).default(0),
  /** Max failed attempts before auto-expiry (default 3 from Membership.sol). */
  max_failed_attempts: z.number().int().min(1).default(3),
  auto_renew: z.boolean().default(true),

  // Aggregate stats
  total_paid: z.string().default('0'),
  payments_count: z.number().int().min(0).default(0),

  // Timestamps
  created_at: z.union([z.number(), z.string()]).optional(),
  updated_at: z.union([z.number(), z.string()]).optional(),
  cancelled_at: z.number().int().optional(),
  expired_at: z.number().int().optional(),
})

export type SubscriptionLedgerRow = z.infer<typeof subscriptionLedgerSchema>

// ---------------------------------------------------------------------------
// Query / filter schemas
// ---------------------------------------------------------------------------

export const subscriptionLedgerFilterSchema = z.object({
  user_id: z.string().optional(),
  provider: subscriptionProviderSchema.optional(),
  status: subscriptionStatusSchema.optional(),
  method: z.enum(['card', 'credit_balance', 'crypto', 'nft', 'paypal', 'stars']).optional(),
  due_before: z.number().int().optional(),   // next_payment_due < this
  due_after: z.number().int().optional(),     // next_payment_due > this
})

export type SubscriptionLedgerFilter = z.infer<typeof subscriptionLedgerFilterSchema>

// ---------------------------------------------------------------------------
// Admin stats response
// ---------------------------------------------------------------------------

export const subscriptionStatsSchema = z.object({
  total_active: z.number().int(),
  total_grace_period: z.number().int(),
  total_expired: z.number().int(),
  total_cancelled: z.number().int(),
  total_suspended: z.number().int(),
  due_for_payment: z.number().int(),
  by_provider: z.record(subscriptionProviderSchema, z.number().int()),
  by_method: z.record(z.string(), z.number().int()),
})

export type SubscriptionStats = z.infer<typeof subscriptionStatsSchema>
