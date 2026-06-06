import { NextRequest, NextResponse } from 'next/server'
import { dispatchWayForPayWebhook } from '@/lib/payments/conductor/webhook-dispatcher'
import { logger } from '@/lib/logger'

/**
 * Canonical WayForPay webhook — dispatches by orderReference prefix.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Record<string, unknown>
    const result = await dispatchWayForPayWebhook(payload)

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
