import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature, processSuccessfulPayment } from '@/lib/payments/wayforpay-service'
import { logger } from '@/lib/logger'
import crypto from 'crypto'

/**
 * WayForPay Webhook Handler
 * 
 * Receives payment status notifications from WayForPay and processes them.
 * CRITICAL: Always validates HMAC signature before processing.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()

    logger.info('WayForPay webhook: Received notification', {
      orderReference: payload.orderReference,
      transactionStatus: payload.transactionStatus,
      amount: payload.amount
    })

    // CRITICAL: Verify webhook signature
    const isValidSignature = verifyWebhookSignature(payload)
    if (!isValidSignature) {
      logger.error('WayForPay webhook: Invalid signature detected - possible attack', {
        orderReference: payload.orderReference,
        receivedSignature: payload.merchantSignature
      })

      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Process the payment
    const processed = await processSuccessfulPayment(payload)

    if (!processed) {
      logger.warn('WayForPay webhook: Payment processing failed', {
        orderReference: payload.orderReference,
        status: payload.transactionStatus
      })

      // Still return 200 to acknowledge receipt
      return NextResponse.json({
        orderReference: payload.orderReference,
        status: 'accept',
        time: Math.floor(Date.now() / 1000)
      })
    }

    // Generate acknowledgment signature
    const secretKey = process.env.WAYFORPAY_SECRET_KEY
    if (!secretKey) {
      throw new Error('WAYFORPAY_SECRET_KEY not configured')
    }

    const time = Math.floor(Date.now() / 1000)
    const signatureData = {
      orderReference: payload.orderReference,
      status: 'accept',
      time
    }

    const signatureString = Object.values(signatureData).join(';')
    const signature = crypto
      .createHmac('md5', secretKey)
      .update(signatureString)
      .digest('hex')

    logger.info('WayForPay webhook: Payment processed successfully', {
      orderReference: payload.orderReference
    })

    // Return signed acknowledgment
    return NextResponse.json({
      orderReference: payload.orderReference,
      status: 'accept',
      time,
      signature
    })

  } catch (error) {
    logger.error('WayForPay webhook: Unexpected error', error)
    
    // Return 500 to trigger WayForPay retry
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'wayforpay-webhook' })
}
