import { NextRequest, NextResponse } from 'next/server'
import { dispatchWayForPayWebhook } from '@/lib/payments/conductor/webhook-dispatcher'
import { wayforpayWebhookSchema } from '@/lib/payments/wayforpay-webhook-schema'

/** @deprecated Use POST /api/payments/wayforpay/webhook — thin delegate */
export async function POST(request: NextRequest) {
  const raw = await request.json()
  const parsed = wayforpayWebhookSchema.safeParse(raw)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const payload = parsed.data
  await dispatchWayForPayWebhook(payload as Record<string, unknown>)
  return NextResponse.json({
    orderReference: payload.orderReference,
    status: 'accept',
    time: Math.floor(Date.now() / 1000),
  })
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'WayForPay Store Webhook (alias)',
    canonical: '/api/payments/wayforpay/webhook',
    status: 'active',
    timestamp: new Date().toISOString(),
  })
}
