import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { REF_COOKIE_NAME } from '@/features/refcodes/constants'
import {
  getBuyerWalletAddresses,
  resolveOrderReferral,
} from '@/features/refcodes/services/attribution-service'
import { reserveInventoryForOrder } from '@/features/store/services/inventory-sync'
import { logger } from '@/lib/logger'

/**
 * POST /api/store/checkout
 *
 * Canonical checkout entry: writes the `orders` collection via StoreOrdersService
 * (the same pipeline as /api/store/orders — attribution, payment conductor,
 * settlements, stock). The legacy adapter path wrote `store_orders`, which the
 * payment webhook never reads — orders created there were unpayable.
 */
export async function POST(req: NextRequest) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { items, info } = body || {}
    if (!items || !Array.isArray(items) || items.length === 0 || !info) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const subtotal = items.reduce(
      (sum: number, item: any) => sum + parseFloat(item.product?.price ?? item.price ?? '0') * (item.quantity || 1),
      0
    )

    const orderPayload = {
      items,
      subtotal,
      total: subtotal,
      shippingInfo: {
        name: [info.firstName, info.lastName].filter(Boolean).join(' ') || info.name || '',
        phone: info.phone || '',
        address: info.address || '',
        city: info.city || '',
        postalCode: info.postalCode || '',
        country: info.country,
        email: info.email,
        notes: info.notes,
      },
    }

    const refCode = req.cookies.get(REF_COOKIE_NAME)?.value
    const buyerWallets = await getBuyerWalletAddresses(session.user.id)
    const referral = await resolveOrderReferral(session.user.id, refCode, buyerWallets)

    const { orderId } = await StoreOrdersService.createOrder(
      session.user.id,
      orderPayload as never,
      referral || undefined
    )

    // Hold stock for products with configured inventory levels (15-min TTL,
    // released by cron cleanup-reservations if payment never lands).
    try {
      const reservationItems = items.map((item: any) => ({
        productId: item.product?.id ?? item.productId,
        quantity: item.quantity || 1,
      }))
      const { reserved, skipped } = await reserveInventoryForOrder(orderId, reservationItems)
      if (reserved.length > 0) {
        logger.info('Checkout: inventory reserved', { orderId, reserved: reserved.length, skipped: skipped.length })
      }
    } catch (reservationError) {
      // Insufficient configured stock — cancel the just-created order and reject.
      await StoreOrdersService.adminUpdateOrderStatus(orderId, 'canceled')
      const message = reservationError instanceof Error ? reservationError.message : 'Insufficient stock'
      return NextResponse.json({ error: message }, { status: 409 })
    }

    return NextResponse.json({
      orderId,
      referralApplied: Boolean(referral),
      ...(referral ? { referralCode: referral.referralCode } : {}),
    })
  } catch (e: any) {
    logger.error('Checkout failed', { error: e?.message })
    return NextResponse.json({ error: e?.message || 'Checkout failed' }, { status: 500 })
  }
}
