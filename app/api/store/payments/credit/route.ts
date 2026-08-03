import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { PaymentConductor } from '@/lib/payments/conductor/payment-conductor'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { canSpendCreditForOrderCurrency } from '@/lib/payments/payment.config'
import { fulfillStoreOrderPaid } from '@/lib/payments/conductor/fulfill-store-order-paid'
import { getMainCurrencySymbol } from '@/lib/ring-config-core'

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

    const currency = getMainCurrencySymbol()
    if (!canSpendCreditForOrderCurrency(currency)) {
      return NextResponse.json(
        {
          error: `Credit balance cannot be used for ${currency} orders on this site. Use card payment or add ${currency} to PAYMENT_CREDIT_BALANCE_ACCEPTED_ORDER_CURRENCIES.`,
        },
        { status: 400 }
      )
    }

    const result = await PaymentConductor.createCheckout({
      purpose: 'store_order',
      rail: 'credit_balance',
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

    await fulfillStoreOrderPaid({
      orderId: body.orderId,
      orderReference: result.orderReference ?? '',
      amount: order.total ?? 0,
      currency,
      rail: 'credit_balance',
      processor: 'credit_balance',
      processorPayload: { orderReference: result.orderReference },
      source: 'Store credit balance',
    })

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
