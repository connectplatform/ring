import { NextRequest, NextResponse, connection } from 'next/server'
import { dispatchWayForPayWebhook } from '@/lib/payments/conductor/webhook-dispatcher'

/** @deprecated Use POST /api/payments/wayforpay/webhook — thin delegate */
export async function POST(request: NextRequest) {
  await connection()
  const payload = (await request.json()) as Record<string, unknown>
  await dispatchWayForPayWebhook(payload)
  return NextResponse.json({ success: true })
}
