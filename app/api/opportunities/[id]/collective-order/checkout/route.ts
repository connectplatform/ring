import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import { collectiveOrderEscrowService } from '@/features/opportunities/services/collective-order-escrow-service'
import { getSiteBaseUrl } from '@/lib/ring-config-core'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'

const schema = z.object({
  rail: z.enum(['credit_balance', 'card', 'paypal']),
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

  const { id: opportunityId } = await context.params
  const body = schema.parse(await request.json().catch(() => ({})))
  const locale = (body.locale || 'en') as Locale
  const base = getSiteBaseUrl().replace(/\/$/, '')
  const returnUrl = `${base}${ROUTES.OPPORTUNITY(opportunityId, locale)}`

  const processor =
    body.processor ??
    (body.rail === 'paypal' ? 'paypal' : undefined)

  const result = await collectiveOrderEscrowService.reserveSlot({
    opportunityId,
    userId: session.user.id,
    userEmail: session.user.email ?? '',
    rail: body.rail,
    returnUrl,
    locale: body.locale,
    processor,
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? 'Reserve failed' }, { status: 400 })
  }

  const checkout = result.checkout
  return NextResponse.json({
    success: true,
    paid: body.rail === 'credit_balance' || Boolean(checkout?.paid),
    opportunityClosed: result.opportunityClosed,
    slotsFilled: result.slotsFilled,
    slotCount: result.slotCount,
    escrowId: result.escrow?.id,
    redirect: checkout?.redirect,
    paymentUrl: checkout?.paymentUrl,
    paymentFields: checkout?.paymentFields,
    orderReference: checkout?.orderReference,
  })
}
