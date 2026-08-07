import { NextRequest, NextResponse, connection } from 'next/server'
import type { Session } from 'next-auth'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import type { PaymentPurpose } from '@/lib/payments/conductor/types'
import { logger } from '@/lib/logger'

function canManageUsers(session: Session | null) {
  return !!session?.user && isPlatformAdmin(session.user.role)
}

/**
 * GET /api/admin/users/[id]/payments
 * Admin Payments tab — membership_upgrade + wallet_topup from payment_transactions SSOT.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection()

  const session = await auth()
  if (!canManageUsers(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: userId } = await context.params
  if (!userId) {
    return NextResponse.json({ error: 'User id required' }, { status: 400 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit') || 50), 100)
    const purposeParam = searchParams.get('purposes')
    const purposes = purposeParam
      ? (purposeParam.split(',').filter(Boolean) as PaymentPurpose[])
      : (['membership_upgrade', 'wallet_topup'] as PaymentPurpose[])

    const payments = await paymentTransactionService.listByUserId(userId, {
      purposes,
      limit,
    })

    return NextResponse.json({
      success: true,
      payments: payments.map((p) => ({
        id: p.id,
        purpose: p.purpose,
        processor: p.processor,
        rail: p.rail,
        orderReference: p.order_reference,
        status: p.status,
        amountMinor: p.amount_minor,
        currency: p.currency,
        paidAt: p.paid_at,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        statusHistory: p.status_history,
      })),
    })
  } catch (error) {
    logger.error('Admin user payments list failed', { userId, error })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load payments' },
      { status: 500 },
    )
  }
}
