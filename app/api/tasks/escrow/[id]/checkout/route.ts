import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import { PaymentConductor } from '@/lib/payments/conductor/payment-conductor'
import { taskEscrowService } from '@/features/tasks/services/task-escrow-service'
import { getSiteBaseUrl } from '@/lib/ring-config-core'
import { withLocale, ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'

const schema = z.object({
  rail: z.enum(['card', 'native_token']).optional(),
  locale: z.string().optional(),
  returnConversationId: z.string().optional(),
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

  const { id: escrowId } = await context.params
  const escrow = await taskEscrowService.getById(escrowId)
  if (!escrow) {
    return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
  }
  if (escrow.reporterUserId !== session.user.id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }
  if (escrow.paymentStatus === 'held') {
    return NextResponse.json({ error: 'Escrow already funded' }, { status: 400 })
  }
  if (escrow.paymentStatus !== 'pending') {
    return NextResponse.json({ error: 'Escrow is not awaiting checkout' }, { status: 400 })
  }

  const body = schema.parse(await request.json().catch(() => ({})))
  const locale = (body.locale || 'en') as Locale
  const base = getSiteBaseUrl().replace(/\/$/, '')
  const conversationId = body.returnConversationId ?? escrow.conversationId
  const returnPath = conversationId
    ? `${ROUTES.MESSAGES(locale)}?c=${encodeURIComponent(conversationId)}`
    : ROUTES.TASKS(locale)
  const returnUrl = `${base}${returnPath}`

  const rail =
    body.rail ??
    (escrow.currencyType === 'native_token' ? 'native_token' : 'card')

  const currency =
    escrow.currencyCode ??
    (escrow.currencyType === 'native_token' ? 'RING' : 'USD')

  const result = await PaymentConductor.createCheckout({
    purpose: 'task_escrow',
    rail,
    userId: session.user.id,
    userEmail: session.user.email ?? '',
    entityId: escrowId,
    orderId: escrowId,
    taskEscrowId: escrowId,
    amount: escrow.amount,
    currency,
    returnUrl,
    locale: body.locale,
    metadata: {
      purpose: 'task_escrow',
      taskEscrowId: escrowId,
      messageId: escrow.messageId,
      conversationId: escrow.conversationId,
      ...(body.processor ? { processor: body.processor } : {}),
    },
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? 'Checkout failed' }, { status: 400 })
  }

  if (result.paid && result.orderReference) {
    await taskEscrowService.markHeldFromPayment(
      escrowId,
      result.orderReference,
      {
        txHash: result.txHash,
        rail,
      },
    )
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
