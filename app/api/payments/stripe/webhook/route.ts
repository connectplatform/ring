import { NextRequest, NextResponse, connection, after } from 'next/server'
import { dispatchStripeWebhook } from '@/lib/payments/conductor/webhook-dispatcher'
import { stripeWebhookInputSchema } from '@/lib/payments/stripe-webhook-schema'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  await connection()
  try {
    const rawBody = await request.text()

    // Validate raw body shape before proceeding
    const parsed = stripeWebhookInputSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const signature = request.headers.get('stripe-signature') ?? ''

    // Defer signature verification + dispatch — Stripe needs 200 fast.
    // The after() callback fires after the response is sent (Next.js 16).
    after(async () => {
      await dispatchStripeWebhook(rawBody, signature).catch(() => {
        logger.error('Stripe webhook: background dispatch failed', { rawBodyLen: rawBody.length })
      })
    })

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error('Stripe webhook error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'stripe-webhook' })
}
