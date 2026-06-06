import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { PaymentConductor } from '@/lib/payments/conductor/payment-conductor'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { canSpendCreditForOrderCurrency } from '@/lib/payments/payment.config'

const schema = z.object({
  orderId: z.string().min(1),
})

export async function POST(request: NextRequest) {
  await connection()
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = schema.parse(await request.json())
    const order = (await StoreOrdersService.getOrderById(body.orderId)) as {
      userId?: string
      total?: number
      payment?: { status?: string }
    } | null

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    if (order.userId !== session.user.id) {
      return NextResponse.json({ error: 'Order access denied' }, { status: 403 })
    }
    if (order.payment?.status === 'paid') {
      return NextResponse.json({ error: 'Order already paid' }, { status: 400 })
    }

    const currency = 'UAH'
    if (!canSpendCreditForOrderCurrency(currency)) {
      return NextResponse.json(
        {
          error:
            'Credit balance cannot be used for UAH orders on this site. Use card payment or configure PAYMENT_CREDIT_ACCEPT_ORDER_CURRENCY=UAH.',
        },
        { status: 400 }
      )
    }

    const result = await PaymentConductor.createCheckout({
      purpose: 'store_order',
      rail: 'internal_credit',
      userId: session.user.id,
      userEmail: session.user.email ?? '',
      entityId: body.orderId,
      orderId: body.orderId,
      amount: order.total ?? 0,
      currency,
      returnUrl: '',
    })

    if (!result.success || !result.paid) {
      return NextResponse.json({ error: result.error ?? 'Credit payment failed' }, { status: 400 })
    }

    await StoreOrdersService.updateOrderPaymentStatus(body.orderId, {
      method: 'credit',
      status: 'paid',
      amount: order.total ?? 0,
      currency,
      paidAt: new Date().toISOString(),
    })
    await StoreOrdersService.adminUpdateOrderStatus(body.orderId, 'paid')

    return NextResponse.json({
      success: true,
      paid: true,
      orderReference: result.orderReference,
      orderId: body.orderId,
    })
  } catch (error) {
    logger.error('Store credit payment error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
