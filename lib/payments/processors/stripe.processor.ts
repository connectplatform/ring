import type { CreateCheckoutContext, CreateCheckoutResult } from '@/lib/payments/conductor/types'
import { buildOrderReference } from '@/lib/payments/order-reference'
import { getWebhookUrl } from '@/lib/payments/payment.config'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'

const STRIPE_API_VERSION = '2024-11-20.acacia' as const

export async function createStripeCheckout(ctx: CreateCheckoutContext): Promise<CreateCheckoutResult> {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    return { success: false, error: 'Stripe not configured' }
  }

  const orderReference = buildOrderReference(ctx.purpose, {
    orderId: ctx.orderId ?? ctx.entityId,
    userId: ctx.userId,
    articleId: ctx.articleId ?? ctx.entityId,
  })

  await paymentTransactionService.createPending({
    purpose: ctx.purpose,
    processor: 'stripe',
    rail: 'merchant_redirect',
    orderReference,
    entityType: ctx.purpose,
    entityId: ctx.entityId,
    userId: ctx.userId,
    amountMinor: Math.round(ctx.amount * 100),
    currency: ctx.currency.toLowerCase(),
  })

  try {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(secret, { apiVersion: STRIPE_API_VERSION as any })

    const currency = ctx.currency.toLowerCase()
    const amountMinor = Math.round(ctx.amount * 100)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: ctx.userEmail,
      line_items: [
        {
          price_data: {
            currency,
            unit_amount: amountMinor,
            product_data: {
              name: productNameForPurpose(ctx),
              description: ctx.entityId,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${ctx.returnUrl}${ctx.returnUrl.includes('?') ? '&' : '?'}paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: ctx.returnUrl,
      metadata: {
        purpose: ctx.purpose,
        entityId: ctx.entityId,
        userId: ctx.userId,
        articleId: ctx.articleId ?? '',
        orderReference,
      },
    })

    await paymentTransactionService.markRedirected(orderReference)

    return {
      success: true,
      paymentUrl: session.url ?? undefined,
      orderReference,
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Stripe error'
    return { success: false, error: message }
  }
}

function productNameForPurpose(ctx: CreateCheckoutContext): string {
  switch (ctx.purpose) {
    case 'news_promotion':
      return 'News main-page promotion'
    case 'store_order':
      return 'Store order'
    case 'membership_upgrade':
      return 'Membership upgrade'
    default:
      return 'Ring payment'
  }
}

export async function verifyStripeWebhook(
  rawBody: string,
  signature: string
): Promise<{ type: string; data: { object: Record<string, unknown> } } | null> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const key = process.env.STRIPE_SECRET_KEY
  if (!secret || !key) return null
  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(key, { apiVersion: STRIPE_API_VERSION as any })
  try {
    const event = stripe.webhooks.constructEvent(rawBody, signature, secret)
    return event as unknown as { type: string; data: { object: Record<string, unknown> } }
  } catch {
    return null
  }
}

export { getWebhookUrl }
