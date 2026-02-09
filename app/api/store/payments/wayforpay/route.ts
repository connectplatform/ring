import { NextRequest, NextResponse, connection} from 'next/server'
import { auth } from '@/auth'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { 
  initiateStorePayment,
  calculateVendorSettlements,
  type StorePaymentRequest 
} from '@/lib/payments/wayforpay-store-service'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { getVendorEntity } from '@/features/entities/services/vendor-entity'
import { getVendorProfile } from '@/features/store/services/vendor-profile'
import { UserRole } from '@/features/auth/types'

// Validation schema for payment request
const createPaymentSchema = z.object({
  orderId: z.string().min(1),
  returnUrl: z.string().url().optional(),
  locale: z.enum(['UK', 'EN', 'RU']).optional()
})

/**
 * POST /api/store/payments/wayforpay
 * Initiates a WayForPay payment session for a store order
 */
export async function POST(request: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    logger.info('Store WayForPay Payment: Starting payment initiation')

    // Step 1: Authenticate user
    const session = await auth()
    if (!session?.user?.id) {
      logger.warn('Store WayForPay Payment: Unauthorized access attempt')
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Step 2: Parse and validate request
    const body = await request.json()
    const validationResult = createPaymentSchema.safeParse(body)
    
    if (!validationResult.success) {
      const issues = (validationResult as any).error?.issues || (validationResult as any).error
      logger.warn('Store WayForPay Payment: Invalid request data', {
        issues
      })
      return NextResponse.json(
        { error: 'Invalid request data', details: issues },
        { status: 400 }
      )
    }

    const { orderId, returnUrl, locale } = validationResult.data

    // Step 3: Get order details
    const order = await StoreOrdersService.getOrderById(orderId) as any
    
    if (!order) {
      logger.warn('Store WayForPay Payment: Order not found', { orderId })
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Verify order belongs to user
    if (order.userId !== session.user.id) {
      logger.warn('Store WayForPay Payment: Order access denied', {
        orderId,
        userId: session.user.id,
        orderUserId: order.userId
      })
      return NextResponse.json(
        { error: 'Order access denied' },
        { status: 403 }
      )
    }

    // Check if order is already paid
    if (order.payment?.status === 'paid') {
      logger.warn('Store WayForPay Payment: Order already paid', { orderId })
      return NextResponse.json(
        { error: 'Order is already paid' },
        { status: 400 }
      )
    }

    // Step 4: Prepare vendor tiers for settlement calculation
    const vendorTiers: Record<string, string> = {}
    
    // Get unique vendor IDs from order items
    const vendorIds = new Set<string>()
    for (const item of order.items) {
      if (item.product?.productOwner) {
        vendorIds.add(item.product.productOwner)
      }
    }

    // Get vendor profiles to determine commission tiers
    for (const vendorId of vendorIds) {
      try {
        const vendorEntity = await getVendorEntity(vendorId)
        if (vendorEntity) {
          const vendorProfile = await getVendorProfile(vendorEntity.id)
          if (vendorProfile) {
            // trustLevel is canonical;
            vendorTiers[vendorId] = (vendorProfile as any).trustLevel || (vendorProfile as any).trustTier || 'NEW'
          }
        }
      } catch (error) {
        logger.warn('Store WayForPay Payment: Failed to get vendor tier', {
          vendorId,
          error
        })
        vendorTiers[vendorId] = 'NEW' // Default to highest commission
      }
    }

    // Step 5: Calculate vendor settlements
    const settlements = await calculateVendorSettlements(order.items, vendorTiers)

    logger.info('Store WayForPay Payment: Calculated vendor settlements', {
      orderId,
      settlementCount: settlements.length,
      totalAmount: order.total
    })

    // Step 6: Prepare payment request
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get('host')}`
    const webhookUrl = `${baseUrl}/api/store/payments/wayforpay/webhook`
    const defaultReturnUrl = `${baseUrl}/store/checkout/processing?orderId=${orderId}`

    const paymentRequest: StorePaymentRequest = {
      orderId: order.id,
      userId: session.user.id,
      userEmail: session.user.email || order.shippingInfo?.email || '',
      items: order.items,
      totalAmount: order.total || 0,
      currency: 'UAH', // Default to UAH for Ukrainian market
      shippingInfo: order.shippingInfo || {
        firstName: '',
        lastName: ''
      },
      returnUrl: returnUrl || defaultReturnUrl,
      webhookUrl,
      locale: locale || 'UK'
    }

    // Step 7: Initiate WayForPay payment
    const paymentResponse = await initiateStorePayment(paymentRequest)

    if (!paymentResponse.success) {
      logger.error('Store WayForPay Payment: Failed to initiate payment', {
        orderId,
        error: paymentResponse.error
      })
      return NextResponse.json(
        { error: paymentResponse.error || 'Failed to initiate payment' },
        { status: 500 }
      )
    }

    // Step 8: Update order with payment session info
    try {
      await StoreOrdersService.updateOrderPaymentStatus(order.id, {
        method: 'wayforpay',
        status: 'pending',
        wayforpayOrderId: paymentResponse.wayforpayOrderId,
        amount: order.total || 0,
        currency: 'UAH'
      })

      // Store vendor settlements for later processing
      if (settlements.length > 0) {
        await StoreOrdersService.updateOrderSettlements(
          order.id, 
          settlements.map(s => ({ ...s, status: 'pending' as const }))
        )
      }
    } catch (updateError) {
      logger.warn('Store WayForPay Payment: Failed to update order payment status', {
        orderId,
        error: updateError
      })
      // Continue anyway as payment session is created
    }

    logger.info('Store WayForPay Payment: Payment initiated successfully', {
      orderId,
      wayforpayOrderId: paymentResponse.wayforpayOrderId,
      paymentUrl: paymentResponse.paymentUrl?.substring(0, 100) // Log partial URL for security
    })

    // Step 9: Return payment URL for redirect
    return NextResponse.json({
      success: true,
      paymentUrl: paymentResponse.paymentUrl,
      wayforpayOrderId: paymentResponse.wayforpayOrderId,
      orderId: order.id
    })

  } catch (error) {
    logger.error('Store WayForPay Payment: Unexpected error:', error)
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
 * GET /api/store/payments/wayforpay
 * Health check endpoint
 */
export async function GET() {
  await connection() // Next.js 16: opt out of prerendering

  return NextResponse.json({
    service: 'WayForPay Store Payment',
    status: 'active',
    timestamp: new Date().toISOString()
  })
}
