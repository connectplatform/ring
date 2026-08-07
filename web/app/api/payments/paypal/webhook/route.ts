import { NextRequest, NextResponse, connection, after } from 'next/server'
import { dispatchPayPalWebhook } from '@/lib/payments/conductor/webhook-dispatcher'
import { logger } from '@/lib/logger'

/**
 * POST /api/payments/paypal/webhook
 * Canonical PayPal webhook ingress → PaymentConductor dispatch (verify + purpose handlers).
 */
export async function POST(request: NextRequest) {
  await connection()
  try {
    const rawBody = await request.text()
    const headers = {
      transmissionId: request.headers.get('paypal-transmission-id') ?? '',
      transmissionTime: request.headers.get('paypal-transmission-time') ?? '',
      transmissionSig: request.headers.get('paypal-transmission-sig') ?? '',
      certUrl: request.headers.get('paypal-cert-url') ?? '',
      authAlgo: request.headers.get('paypal-auth-algo') ?? 'SHA256withRSA',
    }

    // Ack quickly; process verify+fulfill in after()
    after(async () => {
      await dispatchPayPalWebhook(rawBody, headers).catch((error) => {
        logger.error('PayPal webhook: background dispatch failed', {
          error,
          rawBodyLen: rawBody.length,
        })
      })
    })

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error('PayPal webhook error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'paypal-webhook' })
}
