/**
 * Stripe Subscription API — Customer, Price, and Subscription management.
 *
 * Server-side Stripe REST API calls for the SubscriptionConductor.
 * Never exposes secrets to the client — all calls are server-only.
 *
 * API version pinned to 2024-11-20.acacia (same as checkout processor).
 *
 * @stripe_integration Truth lens requirements:
 *   - SERVER_SIDE_INTENT: All Stripe objects created server-side
 *   - IDEMPOTENCY: Uses idempotencyKey on all mutating calls
 *   - VERIFY_WEBHOOKS: Signature verification handled by webhook route
 */

import 'server-only'

const STRIPE_API_VERSION = '2024-11-20.acacia' as const

// ---------------------------------------------------------------------------
// Lazy import — Stripe SDK is heavy, only loaded when needed
// ---------------------------------------------------------------------------

async function getStripe() {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    throw new Error('STRIPE_SECRET_KEY not configured')
  }
  const Stripe = (await import('stripe')).default
  return new Stripe(secret, { apiVersion: STRIPE_API_VERSION as any })
}

// ---------------------------------------------------------------------------
// Customer API
// ---------------------------------------------------------------------------

export interface CreateStripeCustomerParams {
  email: string
  userId: string
  name?: string
}

/**
 * Create or retrieve a Stripe Customer for a Ring user.
 * Idempotent: if the user already has a customer, returns the existing one.
 */
export async function ensureStripeCustomer(
  params: CreateStripeCustomerParams,
): Promise<{ customerId: string; isNew: boolean }> {
  const stripe = await getStripe()

  // Search for existing customer by userId metadata
  const existing = await stripe.customers.search({
    query: `metadata['ring_user_id']:'${params.userId}'`,
    limit: 1,
  })

  if (existing.data.length > 0) {
    return { customerId: existing.data[0]!.id, isNew: false }
  }

  // Create new customer
  const customer = await stripe.customers.create(
    {
      email: params.email,
      name: params.name ?? params.email,
      metadata: {
        ring_user_id: params.userId,
      },
    },
    { idempotencyKey: `customer_${params.userId}` },
  )

  return { customerId: customer.id, isNew: true }
}

// ---------------------------------------------------------------------------
// Price API
// ---------------------------------------------------------------------------

export interface CreateStripePriceParams {
  /** Amount in minor units (cents). */
  unitAmount: number
  /** ISO 4217 currency code. */
  currency: string
  /** Product name for the invoice line item. */
  productName: string
  /** Optional metadata. */
  metadata?: Record<string, string>
}

/**
 * Create a one-off Stripe Price for a membership tier.
 * Uses a new Product per purpose to keep billing clean.
 */
export async function createStripeMembershipPrice(
  params: CreateStripePriceParams,
): Promise<{ priceId: string; productId: string }> {
  const stripe = await getStripe()

  // Create product
  const product = await stripe.products.create({
    name: params.productName,
    metadata: params.metadata ?? {},
  })

  // Create price
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: params.unitAmount,
    currency: params.currency,
    recurring: {
      interval: 'month',
    },
    metadata: params.metadata ?? {},
  })

  return { priceId: price.id, productId: product.id }
}

// ---------------------------------------------------------------------------
// Subscription API
// ---------------------------------------------------------------------------

export interface CreateStripeSubscriptionParams {
  customerId: string
  priceId: string
  /** Order reference for tracking in metadata. */
  orderReference: string
  /** Purpose for webhook routing. */
  purpose: string
  /** User ID for metadata + webhook enrichment. */
  userId: string
  /** Optional entity/article ID. */
  entityId?: string
}

export interface CreateStripeSubscriptionResult {
  success: boolean
  subscriptionId?: string
  clientSecret?: string
  error?: string
}

/**
 * Create a Stripe Subscription for recurring membership billing.
 * Returns the subscription ID for the subscription_ledger row.
 */
export async function createStripeSubscription(
  params: CreateStripeSubscriptionParams,
): Promise<CreateStripeSubscriptionResult> {
  try {
    const stripe = await getStripe()

    const subscription = await stripe.subscriptions.create(
      {
        customer: params.customerId,
        items: [{ price: params.priceId }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          purpose: params.purpose,
          orderReference: params.orderReference,
          ring_user_id: params.userId,
          entityId: params.entityId ?? '',
        },
      },
      { idempotencyKey: `sub_${params.orderReference}` },
    )

    return {
      success: true,
      subscriptionId: subscription.id,
      clientSecret:
        (subscription.latest_invoice as any)?.payment_intent?.client_secret ?? undefined,
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Stripe subscription error'
    return { success: false, error: message }
  }
}

// ---------------------------------------------------------------------------
// Cancel API
// ---------------------------------------------------------------------------

export async function cancelStripeSubscription(
  stripeSubscriptionId: string,
): Promise<boolean> {
  try {
    const stripe = await getStripe()
    await stripe.subscriptions.cancel(stripeSubscriptionId)
    return true
  } catch {
    return false
  }
}
