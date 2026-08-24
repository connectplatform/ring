import { NextRequest, NextResponse, connection } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { logger } from '@/lib/logger'
import { refundNativePayment } from '@/lib/payments/native-refund-service'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { getVendorEntities } from '@/features/entities/services/vendor-entity'

const refundSchema = z.object({
  reason: z.string().max(500).optional(),
})

/**
 * Vendor-owns-store gate: a store orderReference (store_<orderId>_<ts>) refund is
 * allowed when the caller's vendor entity matches one of the order's vendorSettlements.
 * Membership/other native payments resolve no store order → admin-only.
 */
async function canRefundAsVendor(
  userId: string,
  orderReference: string,
): Promise<boolean> {
  const storeMatch = /^store_([A-Za-z0-9_-]+)_\d+$/.exec(orderReference)
  if (!storeMatch) return false

  const order = await StoreOrdersService.getOrderById(storeMatch[1]).catch(() => null)
  if (!order) return false

  const settlements = Array.isArray(order.vendorSettlements)
    ? (order.vendorSettlements as Array<{ vendorId?: string; vendorEntityId?: string }>)
    : []
  if (settlements.length === 0) return false

  const vendorIds = settlements
    .map((s) => s.vendorId || s.vendorEntityId)
    .filter((v): v is string => Boolean(v))
  if (vendorIds.length === 0) return false

  const myVendors = await getVendorEntities(userId)
  const myVendorIds = new Set(myVendors.map((v) => v.id))
  return vendorIds.some((id) => myVendorIds.has(id))
}

/**
 * POST /api/admin/payments/[orderReference]/refund
 *
 * Native-token refund (treasury → user) for a paid payment_transactions row.
 * Authorization: platform admin (any native payment) OR vendor who owns the store
 * order (store_order refunds). Idempotent — already-refunded rows replay.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderReference: string }> },
) {
  await connection()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { orderReference } = await context.params

  const admin = isPlatformAdmin(session.user.role)
  const vendor = admin ? false : await canRefundAsVendor(session.user.id, orderReference)
  if (!admin && !vendor) {
    return NextResponse.json(
      { error: 'Platform admin or owning vendor required for refunds' },
      { status: 403 },
    )
  }

  const parsed = refundSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join('; ') },
      { status: 400 },
    )
  }

  const result = await refundNativePayment({
    orderReference,
    requestedBy: session.user.id,
    reason: parsed.data.reason,
  })

  if (result.success === false) {
    const status = result.code === 'NOT_FOUND' ? 404 : 400
    return NextResponse.json({ error: result.error, code: result.code }, { status })
  }

  logger.info('Admin native refund completed', {
    orderReference,
    by: session.user.id,
    asVendor: vendor,
    refundTxHash: result.refundTxHash,
    alreadyRefunded: result.alreadyRefunded,
  })

  return NextResponse.json({
    success: true,
    refundTxHash: result.refundTxHash,
    alreadyRefunded: result.alreadyRefunded ?? false,
  })
}