import { NextRequest, NextResponse, connection } from 'next/server'
import { dispatchWayForPayWebhook } from '@/lib/payments/conductor/webhook-dispatcher'
import { wayforpayWebhookSchema } from '@/lib/payments/wayforpay-webhook-schema'

/** @deprecated Use POST /api/payments/wayforpay/webhook — thin delegate */
export async function POST(request: NextRequest) {
  await connection()
  const raw = await request.json()
  const parsed = wayforpayWebhookSchema.safeParse(raw)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  await dispatchWayForPayWebhook(parsed.data as Record<string, unknown>)
  return NextResponse.json({ success: true })
}
