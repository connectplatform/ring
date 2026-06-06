import { NextRequest, NextResponse } from 'next/server'
import { dispatchWayForPayWebhook } from '@/lib/payments/conductor/webhook-dispatcher'

/** @deprecated Use POST /api/payments/wayforpay/webhook — thin delegate */
export async function POST(request: NextRequest) {
  const payload = (await request.json()) as Record<string, unknown>
  const result = await dispatchWayForPayWebhook(payload)
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
