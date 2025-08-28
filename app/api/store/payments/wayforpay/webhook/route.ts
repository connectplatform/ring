import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { 
  processStorePaymentWebhook,
  verifyStoreWebhookSignature,
  type StoreWebhookPayload 
} from '@/lib/payments/wayforpay-store-service'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { StorePaymentsService } from '@/features/store/services/payments-service'
import { VendorSettlementService } from '@/features/store/services/vendor-settlement'
import type { StorePayment, StoreOrder } from '@/features/store/types'

/**
 * POST /api/store/payments/wayforpay/webhook
 * 
 * Handles payment notifications from WayForPay for store orders.
 * This endpoint processes payment status updates, updates order status,
 * and triggers vendor settlement processing.
 */
export async function POST(request: NextRequest) {
  try {
    logger.info('Store WayForPay Webhook: Received payment notification')

    // Parse the webhook payload
    const payload: StoreWebhookPayload = await request.json()
    
    if (!payload) {
      logger.error('Store WayForPay Webhook: Empty payload received')
      return NextResponse.json(
        { error: 'Empty payload' },
        { status: 400 }
      )
    }

    logger.info('Store WayForPay Webhook: Processing payment notification', {
      orderReference: payload.orderReference,
      transactionStatus: payload.transactionStatus,
      amount: payload.amount,
      currency: payload.currency,
      paymentSystem: payload.paymentSystem
    })

    // Step 1: Verify webhook signature
    if (!verifyStoreWebhookSignature(payload)) {
      logger.error('Store WayForPay Webhook: Invalid signature', {
        orderReference: payload.orderReference
      })
      
      // Return error to WayForPay
      return NextResponse.json({
        orderReference: payload.orderReference,
        status: 'decline',
        time: Math.floor(Date.now() / 1000),
        signature: '' // WayForPay will know it's invalid
      })
    }

    // Step 2: Process the payment webhook
    const result = await processStorePaymentWebhook(payload)
    
    if (!result.success) {
      logger.error('Store WayForPay Webhook: Failed to process payment', {
        orderReference: payload.orderReference,
        error: result.error
      })
      
      // Still acknowledge receipt to WayForPay
      return NextResponse.json({
        orderReference: payload.orderReference,
        status: 'accept',
        time: Math.floor(Date.now() / 1000)
      })
    }

    const orderId = result.orderId!

    // Step 3: Update order payment status based on transaction status
    try {
      const paymentData: StorePayment = {
        method: 'wayforpay',
        status: mapTransactionStatus(payload.transactionStatus),
        wayforpayOrderId: payload.orderReference,
        wayforpayTransactionId: payload.orderReference,
        amount: payload.amount,
        currency: payload.currency,
        cardLast4: payload.cardPan ? payload.cardPan.slice(-4) : undefined,
        cardType: payload.cardType,
        paymentSystem: payload.paymentSystem
      }

      if (payload.transactionStatus === 'Approved') {
        paymentData.paidAt = new Date().toISOString()
        
        // Update order as paid
        await StoreOrdersService.updateOrderPaymentStatus(orderId, paymentData)
        await StoreOrdersService.adminUpdateOrderStatus(orderId, 'paid')
        
        logger.info('Store WayForPay Webhook: Order marked as paid', {
          orderId,
          orderReference: payload.orderReference
        })

        // Step 4: Process vendor settlements for approved payments
        try {
          const order = await StoreOrdersService.getOrderWithPaymentDetails(orderId) as StoreOrder | null

          if (order?.vendorSettlements && order.vendorSettlements.length > 0) {
            await VendorSettlementService.processSettlements(orderId, {
              paymentMethod: 'wayforpay',
              transactionId: payload.orderReference,
              amount: payload.amount,
              currency: payload.currency
            })
            
            logger.info('Store WayForPay Webhook: Vendor settlements initiated', {
              orderId,
              settlementCount: order.vendorSettlements.length
            })
          }
        } catch (settlementError) {
          // Log but don't fail the webhook
          logger.error('Store WayForPay Webhook: Failed to process settlements', {
            orderId,
            error: settlementError
          })
        }

        // Step 5: Send order confirmation email (async, don't wait)
        sendOrderConfirmationEmail(orderId, payload).catch(error => {
          logger.warn('Store WayForPay Webhook: Failed to send confirmation email', {
            orderId,
            error
          })
        })

      } else if (['Declined', 'Expired', 'Refunded', 'Voided'].includes(payload.transactionStatus)) {
        paymentData.failureReason = `${payload.reason} (Code: ${payload.reasonCode})`
        
        // Update order payment as failed
        await StoreOrdersService.updateOrderPaymentStatus(orderId, paymentData)
        
        logger.info('Store WayForPay Webhook: Payment failed/cancelled', {
          orderId,
          orderReference: payload.orderReference,
          status: payload.transactionStatus,
          reason: payload.reason
        })
      } else {
        // Processing, Pending, or other intermediate states
        await StoreOrdersService.updateOrderPaymentStatus(orderId, paymentData)
        
        logger.info('Store WayForPay Webhook: Payment status updated', {
          orderId,
          orderReference: payload.orderReference,
          status: payload.transactionStatus
        })
      }

      // Step 6: Store transaction record for history
      await storePaymentTransaction({
        orderId,
        userId: '', // Will be filled from order data
        gatewayId: 'wayforpay',
        gatewayTransactionId: payload.orderReference,
        amount: payload.amount,
        currency: payload.currency,
        status: mapTransactionStatus(payload.transactionStatus),
        method: 'wayforpay',
        cardLast4: payload.cardPan ? payload.cardPan.slice(-4) : undefined,
        cardType: payload.cardType,
        metadata: {
          authCode: payload.authCode,
          paymentSystem: payload.paymentSystem,
          issuerBankName: payload.issuerBankName,
          issuerBankCountry: payload.issuerBankCountry,
          fee: payload.fee,
          processingDate: payload.processingDate,
          createdDate: payload.createdDate,
          reasonCode: payload.reasonCode,
          reason: payload.reason
        }
      })

    } catch (updateError) {
      logger.error('Store WayForPay Webhook: Failed to update order', {
        orderId,
        orderReference: payload.orderReference,
        error: updateError
      })
    }

    // Step 7: Return success response to WayForPay
    // This is critical - WayForPay will retry if not received
    const response = {
      orderReference: payload.orderReference,
      status: 'accept',
      time: Math.floor(Date.now() / 1000),
      signature: '' // Will be added if needed
    }

    logger.info('Store WayForPay Webhook: Returning success response', {
      orderReference: payload.orderReference,
      orderId
    })

    return NextResponse.json(response)

  } catch (error) {
    logger.error('Store WayForPay Webhook: Unexpected error:', error)
    
    // Return error response to WayForPay
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
 * GET /api/store/payments/wayforpay/webhook
 * Health check for webhook endpoint
 */
export async function GET() {
  return NextResponse.json({
    endpoint: 'WayForPay Store Webhook',
    status: 'active',
    timestamp: new Date().toISOString()
  })
}

/**
 * Maps WayForPay transaction status to our payment status
 */
function mapTransactionStatus(wayforpayStatus: string): StorePayment['status'] {
  const statusMap: Record<string, StorePayment['status']> = {
    'InProcessing': 'processing',
    'WaitingAuthComplete': 'processing',
    'Approved': 'paid',
    'Pending': 'pending',
    'Declined': 'failed',
    'Expired': 'cancelled',
    'Refunded': 'refunded',
    'Voided': 'cancelled',
    'RefundInProcessing': 'processing'
  }
  
  return statusMap[wayforpayStatus] || 'pending'
}

/**
 * Stores payment transaction for history tracking
 */
async function storePaymentTransaction(data: any) {
  try {
    // This will be implemented when we have the transaction storage service
    // For now, just log it
    logger.info('Store WayForPay Webhook: Transaction recorded', {
      orderId: data.orderId,
      transactionId: data.gatewayTransactionId
    })
  } catch (error) {
    logger.error('Store WayForPay Webhook: Failed to store transaction', error)
  }
}

/**
 * Sends order confirmation email
 */
async function sendOrderConfirmationEmail(orderId: string, paymentData: StoreWebhookPayload) {
  try {
    // This will be implemented with the email service
    // For now, just log it
    logger.info('Store WayForPay Webhook: Order confirmation email queued', {
      orderId,
      email: paymentData.email
    })
  } catch (error) {
    logger.error('Store WayForPay Webhook: Failed to send confirmation email', error)
  }
}
