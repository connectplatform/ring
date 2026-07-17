import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import { PaymentConductor } from '@/lib/payments/conductor/payment-conductor'
import { ProjectOrderService } from '@/features/crm/orders/project-order-service'
import { notifyProjectOrderPaid } from '@/features/crm/orders/notify'
import { getSiteBaseUrl } from '@/lib/ring-config-core'
import { withLocale } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'

const schema = z.object({
  rail: z.enum(['merchant_redirect', 'internal_credit']).optional(),
  locale: z.string().optional(),
  processor: z.enum(['wayforpay', 'stripe', 'paypal']).optional(),
})

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection()
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { id } = await context.params
  const order = await ProjectOrderService.getById(id)
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (order.userId !== session.user.id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }
  if (order.paymentStatus === 'paid') {
    return NextResponse.json({ error: 'Order already paid' }, { status: 400 })
  }

  const body = schema.parse(await request.json().catch(() => ({})))
  const locale = (body.locale || 'en') as Locale
  const base = getSiteBaseUrl().replace(/\/$/, '')
  const returnUrl = `${base}${withLocale(locale, `/calculator/success?orderId=${id}`)}`

  const result = await PaymentConductor.createCheckout({
    purpose: 'project_order',
    rail: body.rail,
    userId: session.user.id,
    userEmail: session.user.email ?? '',
    entityId: id,
    orderId: id,
    projectOrderId: id,
    amount: order.amount,
    currency: order.currency,
    returnUrl,
    locale: body.locale,
    metadata: {
      purpose: 'project_order',
      projectOrderId: id,
      ...(body.processor ? { processor: body.processor } : {}),
    },
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? 'Checkout failed' }, { status: 400 })
  }

  if (result.orderReference) {
    if (result.paid) {
      await ProjectOrderService.markPaid(id, result.orderReference)
      // Credit rail settles inline (no webhook) — notify here; WFP/Stripe use project-order handler.
      void notifyProjectOrderPaid({ orderId: id, buyerUserId: session.user.id })
    } else {
      await ProjectOrderService.markPendingPayment(id, result.orderReference)
    }
  }

  return NextResponse.json({
    success: true,
    paid: Boolean(result.paid),
    redirect: result.redirect,
    paymentUrl: result.paymentUrl,
    paymentFields: result.paymentFields,
    orderReference: result.orderReference,
  })
}
