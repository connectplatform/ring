import { NextRequest, NextResponse, connection} from 'next/server'
import { auth } from '@/auth'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { 
  calculateVendorSettlements,
} from '@/lib/payments/wayforpay-store-service'
import { PaymentConductor } from '@/lib/payments/conductor/payment-conductor'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { getMainCurrencySymbol } from '@/lib/ring-config-core'
import { getVendorEntity } from '@/features/entities/services/vendor-entity'
import { getVendorProfile } from '@/features/store/services/vendor-profile'

const createPaymentSchema = z.object({
  orderId: z.string().min(1),
  returnUrl: z.string().url().optional(),
  locale: z.enum(['UK', 'EN', 'RU']).optional()
})

/**
 * POST /api/store/payments/wayforpay
 * Initiates WayForPay via PaymentConductor (store_order → payment_transactions SSOT).
 */
export async function POST(request: NextRequest) {
  await connection()

  try {
    logger.info('Store WayForPay Payment: Starting payment initiation')

    const session = await auth()
    if (!session?.user?.id) {
      logger.warn('Store WayForPay Payment: Unauthorized access attempt')
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validationResult = createPaymentSchema.safeParse(body)
    
    if (!validationResult.success) {
      const issues = validationResult.error.issues
      logger.warn('Store WayForPay Payment: Invalid request data', { issues })
      return NextResponse.json(
        { error: 'Invalid request data', details: issues },
        { status: 400 }
      )
    }

    const { orderId, returnUrl, locale } = validationResult.data

    const order = await StoreOrdersService.getOrderWithPaymentDetails(orderId)
    
    if (!order) {
      logger.warn('Store WayForPay Payment: Order not found', { orderId })
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

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

    if (order.payment?.status === 'paid') {
      logger.warn('Store WayForPay Payment: Order already paid', { orderId })
      return NextResponse.json(
        { error: 'Order is already paid' },
        { status: 400 }
      )
    }

    const vendorTiers: Record<string, string> = {}
    const vendorIds = new Set<string>()
    for (const item of order.items || []) {
      const owner =
        (item as { product?: { productOwner?: string; vendorId?: string } }).product?.productOwner
        || (item as { product?: { vendorId?: string } }).product?.vendorId
      if (owner) vendorIds.add(owner)
    }

    for (const vendorId of vendorIds) {
      try {
        const vendorEntity = await getVendorEntity(vendorId)
        if (vendorEntity) {
          const vendorProfile = await getVendorProfile(vendorEntity.id)
          if (vendorProfile) {
            vendorTiers[vendorId] =
              (vendorProfile as { trustLevel?: string; trustTier?: string }).trustLevel
              || (vendorProfile as { trustTier?: string }).trustTier
              || 'NEW'
          }
        }
      } catch (error) {
        logger.warn('Store WayForPay Payment: Failed to get vendor tier', { vendorId, error })
        vendorTiers[vendorId] = 'NEW'
      }
    }

    const settlements = await calculateVendorSettlements(order.items as never, vendorTiers)

    logger.info('Store WayForPay Payment: Calculated vendor settlements', {
      orderId,
      settlementCount: settlements.length,
      totalAmount: order.total
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get('host')}`
    const defaultReturnUrl = `${baseUrl}/store/checkout/processing?orderId=${orderId}`

    const shippingInfo = {
      firstName: order.shippingInfo?.firstName || '',
      lastName: order.shippingInfo?.lastName || '',
      email: order.shippingInfo?.email || session.user.email || '',
      phone: order.shippingInfo?.phone || '',
      address: typeof order.shippingInfo?.address === 'string' ? order.shippingInfo.address : '',
      city: order.shippingInfo?.city || '',
      postalCode: order.shippingInfo?.postalCode || '',
      country: order.shippingInfo?.country || '',
    }

    const result = await PaymentConductor.createCheckout({
      purpose: 'store_order',
      rail: 'card',
      userId: session.user.id,
      userEmail: session.user.email || shippingInfo.email || '',
      entityId: order.id,
      orderId: order.id,
      amount: order.total || 0,
      currency: getMainCurrencySymbol(),
      items: order.items,
      shippingInfo,
      returnUrl: returnUrl || defaultReturnUrl,
      locale: locale || 'UK',
    })

    if (!result.success || !result.paymentUrl) {
      logger.error('Store WayForPay Payment: PaymentConductor failed', {
        orderId,
        error: result.error
      })
      return NextResponse.json(
        { error: result.error || 'Failed to initiate payment' },
        { status: 500 }
      )
    }

    try {
      await StoreOrdersService.updateOrderPaymentStatus(order.id, {
        method: 'card',
        processor: 'wayforpay',
        status: 'pending',
        wayforpayOrderId: result.orderReference,
        amount: order.total || 0,
        currency: getMainCurrencySymbol()
      })

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
    }

    logger.info('Store WayForPay Payment: Payment initiated via PaymentConductor', {
      orderId,
      orderReference: result.orderReference,
      paymentUrl: result.paymentUrl?.substring(0, 100)
    })

    return NextResponse.json({
      success: true,
      redirect: result.redirect,
      paymentUrl: result.paymentUrl,
      paymentFields: result.paymentFields,
      wayforpayOrderId: result.orderReference,
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

export async function GET() {
  await connection()

  return NextResponse.json({
    service: 'WayForPay Store Payment',
    status: 'active',
    conductor: true,
    timestamp: new Date().toISOString()
  })
}
