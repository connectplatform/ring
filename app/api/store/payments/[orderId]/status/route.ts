import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { logger } from '@/lib/logger'
import { getStorePaymentStatus } from '@/lib/payments/wayforpay-store-service'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { UserRole } from '@/features/auth/types'

/**
 * GET /api/store/payments/[orderId]/status
 * 
 * Checks the payment status for a store order.
 * This endpoint verifies the payment status with WayForPay
 * and returns the current status to the client.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    logger.info('Store Payment Status: Checking payment status', {
      orderId: params.orderId
    })

    // Step 1: Authenticate user
    const session = await auth()
    if (!session?.user?.id) {
      logger.warn('Store Payment Status: Unauthorized access attempt')
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const orderId = params.orderId

    // Step 2: Get order details
    const order = await StoreOrdersService.getOrderWithPaymentDetails(orderId) as any
    
    if (!order) {
      logger.warn('Store Payment Status: Order not found', { orderId })
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Step 3: Verify order belongs to user (unless admin)
    if (order.userId !== session.user.id && session.user.role !== UserRole.ADMIN) {
      logger.warn('Store Payment Status: Order access denied', {
        orderId,
        userId: session.user.id,
        orderUserId: order.userId
      })
      return NextResponse.json(
        { error: 'Order access denied' },
        { status: 403 }
      )
    }

    // Step 4: Check if order has WayForPay payment
    if (!order.payment?.wayforpayOrderId) {
      logger.info('Store Payment Status: No WayForPay payment found', { orderId })
      return NextResponse.json({
        orderId,
        status: order.payment?.status || 'pending',
        paymentMethod: order.payment?.method || null,
        message: 'No WayForPay payment initiated for this order'
      })
    }

    // Step 5: Query WayForPay for current status
    const statusResult = await getStorePaymentStatus(order.payment.wayforpayOrderId)
    
    if (!statusResult.success) {
      logger.warn('Store Payment Status: Failed to get WayForPay status', {
        orderId,
        wayforpayOrderId: order.payment.wayforpayOrderId,
        error: statusResult.error
      })
      
      // Return cached status from database
      return NextResponse.json({
        orderId,
        status: order.payment.status,
        paymentMethod: 'wayforpay',
        amount: order.payment.amount,
        currency: order.payment.currency,
        cached: true,
        message: 'Using cached payment status'
      })
    }

    // Step 6: Map WayForPay status to our status
    const mappedStatus = mapWayForPayStatus(statusResult.transactionStatus!)
    
    // Step 7: Update order if status changed
    if (mappedStatus !== order.payment.status) {
      logger.info('Store Payment Status: Payment status changed', {
        orderId,
        oldStatus: order.payment.status,
        newStatus: mappedStatus
      })
      
      try {
        await StoreOrdersService.updateOrderPaymentStatus(orderId, {
          ...order.payment,
          status: mappedStatus
        })
        
        // Update order status if payment is successful
        if (mappedStatus === 'paid' && order.status !== 'paid') {
          await StoreOrdersService.adminUpdateOrderStatus(orderId, 'paid')
        }
      } catch (updateError) {
        logger.warn('Store Payment Status: Failed to update order status', {
          orderId,
          error: updateError
        })
      }
    }

    // Step 8: Return payment status
    return NextResponse.json({
      orderId,
      status: mappedStatus,
      paymentMethod: 'wayforpay',
      wayforpayStatus: statusResult.transactionStatus,
      amount: statusResult.amount || order.payment.amount,
      currency: statusResult.currency || order.payment.currency,
      lastChecked: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Store Payment Status: Unexpected error:', error)
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
 * Maps WayForPay transaction status to our payment status
 */
function mapWayForPayStatus(wayforpayStatus: string): 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'refunded' {
  const statusMap: Record<string, 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'refunded'> = {
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
