import { NextRequest, NextResponse, connection } from 'next/server'
import { dispatchStripeWebhook } from '@/lib/payments/conductor/webhook-dispatcher'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  await connection()
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('stripe-signature') ?? ''
    const result = await dispatchStripeWebhook(rawBody, signature)

    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'Webhook failed' }, { status: 400 })
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error('Stripe webhook error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'stripe-webhook' })
}
