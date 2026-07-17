import { NextRequest, NextResponse, connection} from 'next/server'
import { auth } from '@/auth'
import { orderCreateSchema } from '@/lib/zod'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { REF_COOKIE_NAME } from '@/features/refcodes/constants'
import {
  getBuyerWalletAddresses,
  resolveOrderReferral,
} from '@/features/refcodes/services/attribution-service'
import { reserveInventoryForOrder } from '@/features/store/services/inventory-sync'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = new URL(req.url)
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 1), 100)
    const startAfter =
      url.searchParams.get('startAfter') || url.searchParams.get('afterId') || undefined
    const { items, lastVisible } = await StoreOrdersService.listOrdersForUser(session.user.id, {
      limit,
      startAfter,
    })
    return NextResponse.json({
      items,
      lastVisible,
      cursor: lastVisible,
      hasMore: Boolean(lastVisible),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const payload = await req.json()
    const parsed = orderCreateSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data
        // Normalize dual shapes (checkout-client shippingInfo/total vs legacy checkoutInfo/totals)
        // payment.method 'ring' = legacy credit alias (old "RING credits" naming) — NOT native token.
        // Prefs heal also maps ring→credit on write; keep route alias for old clients.
        const shippingInfo = data.shippingInfo || data.checkoutInfo
        const total =
          typeof data.total === 'number'
            ? data.total
            : Object.values(data.totals || {}).reduce((s, n) => s + (typeof n === 'number' ? n : 0), 0)

        const normalized = {
          ...data,
          shippingInfo,
          checkoutInfo: data.checkoutInfo || shippingInfo,
          total,
          subtotal: data.subtotal ?? total,
          payment: {
            ...data.payment,
            method:
              // Legacy credit alias ("RING credits") — not in orderCreateSchema enum; defensive cast for old clients/prefs.
              (data.payment.method as string) === 'ring'
                ? 'credit'
                : data.payment.method === 'card'
                  ? 'wayforpay'
                  : data.payment.method,
          },
        }

    const refCode = req.cookies.get(REF_COOKIE_NAME)?.value
    const buyerWallets = await getBuyerWalletAddresses(session.user.id)
    const referral = await resolveOrderReferral(session.user.id, refCode, buyerWallets)
    const { orderId } = await StoreOrdersService.createOrder(
      session.user.id,
      normalized as never,
      referral || undefined,
    )

    try {
      const reservationItems = (data.items || []).map((item) => ({
        productId: item.productId || (item as { product?: { id?: string } }).product?.id || '',
        quantity: item.quantity || 1,
      })).filter((i) => i.productId)

      if (reservationItems.length > 0) {
        const { reserved, skipped } = await reserveInventoryForOrder(orderId, reservationItems)
        if (reserved.length > 0) {
          logger.info('Orders: inventory reserved', {
            orderId,
            reserved: reserved.length,
            skipped: skipped.length,
          })
        }
      }
    } catch (reservationError) {
      await StoreOrdersService.adminUpdateOrderStatus(orderId, 'canceled')
      const message =
        reservationError instanceof Error ? reservationError.message : 'Insufficient stock'
      return NextResponse.json({ error: message }, { status: 409 })
    }

    return NextResponse.json({
      orderId,
      referralApplied: Boolean(referral),
      ...(referral ? { referralCode: referral.referralCode } : {}),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
