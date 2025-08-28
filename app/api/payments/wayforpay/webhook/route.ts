import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

/**
 * WayForPay Webhook Handler
 * 
 * This endpoint receives payment notifications from WayForPay and processes
 * successful payments to upgrade user roles automatically.
 */
export async function POST(request: NextRequest) {
  try {
    logger.info('WayForPay Webhook: Received payment notification')

    // Parse the webhook payload
    const payload = await request.json()
    
    if (!payload) {
      logger.error('WayForPay Webhook: Empty payload received')
      return NextResponse.json(
        { error: 'Empty payload' },
        { status: 400 }
      )
    }

    logger.info('WayForPay Webhook: Processing payment notification', {
      orderReference: payload.orderReference,
      transactionStatus: payload.transactionStatus,
      amount: payload.amount
    })

    // Import and call the payment processing service
    const { processSuccessfulPayment, verifyWebhookSignature } = await import('@/lib/payments/wayforpay-service')

    // Verify the webhook signature first
    if (!verifyWebhookSignature(payload)) {
      logger.error('WayForPay Webhook: Invalid signature', {
        orderReference: payload.orderReference
      })
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Process the payment if it's successful
    if (payload.transactionStatus === 'Approved') {
      const processed = await processSuccessfulPayment(payload)
      
      if (processed) {
        logger.info('WayForPay Webhook: Payment processed successfully', {
          orderReference: payload.orderReference
        })
        
        // Return success response to WayForPay
        return NextResponse.json({
          orderReference: payload.orderReference,
          status: 'accept',
          time: Math.floor(Date.now() / 1000)
        })
      } else {
        logger.error('WayForPay Webhook: Failed to process payment', {
          orderReference: payload.orderReference
        })
        
        // Return error response to WayForPay
        return NextResponse.json({
          orderReference: payload.orderReference,
          status: 'decline',
          time: Math.floor(Date.now() / 1000)
        })
      }
    } else {
      logger.info('WayForPay Webhook: Payment not approved', {
        orderReference: payload.orderReference,
        transactionStatus: payload.transactionStatus,
        reasonCode: payload.reasonCode
      })
      
      // Update payment tracking for failed/declined payments
      try {
        const { updatePaymentStatus } = await import('@/features/auth/services/payment-tracking')
        await updatePaymentStatus(
          payload.orderReference, 
          'failed', 
          `Transaction status: ${payload.transactionStatus}, Reason: ${payload.reasonCode}`
        )
      } catch (trackingError) {
        logger.warn('WayForPay Webhook: Failed to update payment tracking', trackingError)
      }
      
      // Still return accept to acknowledge receipt
      return NextResponse.json({
        orderReference: payload.orderReference,
        status: 'accept',
        time: Math.floor(Date.now() / 1000)
      })
    }

  } catch (error) {
    logger.error('WayForPay Webhook: Error processing webhook:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Handle GET requests (for testing/health checks)
 */
export async function GET() {
  return NextResponse.json({
    message: 'WayForPay webhook endpoint is active',
    timestamp: new Date().toISOString()
  })
}
