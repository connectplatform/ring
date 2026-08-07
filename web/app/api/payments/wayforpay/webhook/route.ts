import { NextRequest, NextResponse } from 'next/server'
import { dispatchWayForPayWebhook } from '@/lib/payments/conductor/webhook-dispatcher'
import { wayforpayWebhookSchema } from '@/lib/payments/wayforpay-webhook-schema'
import type { WayforpayWebhookInput } from '@/lib/payments/wayforpay-webhook-schema'
import { logger } from '@/lib/logger'

/**
 * Canonical WayForPay webhook — dispatches by orderReference prefix.
 */
export async function POST(request: NextRequest) {
  try {
    const raw = await request.json()
    const parsed = wayforpayWebhookSchema.safeParse(raw)

    if (!parsed.success) {
      logger.warn('WayForPay webhook: invalid payload shape', {
        error: parsed.error.issues[0]?.message,
      })
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const payload: WayforpayWebhookInput = parsed.data
    const result = await dispatchWayForPayWebhook(payload as Record<string, unknown>)

    if (!result.success) {
      if (result.error === 'Invalid signature') {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
      return NextResponse.json({
        orderReference: payload.orderReference,
        status: 'accept',
        time: Math.floor(Date.now() / 1000),
      })
    }

    if (result.membershipAck) {
      return NextResponse.json(result.membershipAck)
    }

    return NextResponse.json({
      orderReference: payload.orderReference,
      status: 'accept',
      time: Math.floor(Date.now() / 1000),
    })
  } catch (error) {
    logger.error('WayForPay webhook: Unexpected error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'wayforpay-webhook' })
}
