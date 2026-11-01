import { NextRequest, NextResponse, connection} from 'next/server'
import { auth } from '@/auth'
import { orderCreateSchema } from '@/lib/zod'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { REF_COOKIE_NAME } from '@/features/refcodes/constants'
import {
  getBuyerWalletAddresses,
  resolveOrderReferral,
} from '@/features/refcodes/services/attribution-service'
import { reserveInventoryForOrder, releaseReservationsForOrder } from '@/features/store/services/inventory-sync'
import { cartHoldOrderId } from '@/features/store/constants/stock'
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
        const { quoteStoreOrder } = await import('@/features/store/services/store-quote')
        const quoted = await quoteStoreOrder({
          items: data.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          method: shippingInfo?.method || data.shipping?.provider,
          promoCode: data.promoCode,
          userId: session.user.id,
          buyerEmail: shippingInfo?.email || session.user.email,
        })

        const isOfflinePayment =
          (data.payment?.method as string | undefined) === 'cash' ||
          (data.payment?.method as string | undefined) === 'cod' ||
          (data.payment?.method as string | undefined) === 'invoice'

        const normalized = {
          ...data,
          shippingInfo,
          checkoutInfo: data.checkoutInfo || shippingInfo,
          total: quoted.total,
          subtotal: quoted.subtotal,
          discountAmount: quoted.discount,
          shippingCost: quoted.shipping,
          promoCode: quoted.appliedCode || undefined,
          ...(isOfflinePayment && quoted.appliedCode && quoted.discount > 0
            ? { promoRedemptionCounted: true }
            : {}),
          ...(quoted.vendorSettlements.length ? { vendorSettlements: quoted.vendorSettlements } : {}),
          payment: {
            ...data.payment,
            method:
              data.payment.method === 'card'
                ? 'wayforpay'
                : data.payment.method,
          },
        }

    const refCode = req.cookies.get(REF_COOKIE_NAME)?.value
    const buyerWallets = await getBuyerWalletAddresses(session.user.id)
    const referral = await resolveOrderReferral(session.user.id, refCode, buyerWallets)
    const { parseCurtainAttributionJson, mergeTouchLists, touchesFromUnknown } = await import(
      '@/features/curtain/lib/attribution-storage'
    )
    const { CURTAIN_ATTR_COOKIE } = await import('@/features/curtain/constants')
    const { verifyCurtainTouches } = await import('@/features/curtain/services/verify-touches')
    const curtainAttribution = await verifyCurtainTouches(
      mergeTouchLists(
        parseCurtainAttributionJson(req.cookies.get(CURTAIN_ATTR_COOKIE)?.value),
        touchesFromUnknown(payload?.curtainAttribution),
      ),
    )
    const { orderId } = await StoreOrdersService.createOrder(
      session.user.id,
      normalized as never,
      referral || undefined,
      curtainAttribution.length ? { curtainAttribution } : undefined,
    )
    if (isOfflinePayment && quoted.appliedCode && quoted.discount > 0) {
      const { incrementPromoCodeRedemption } = await import('@/features/store/services/store-settings-service')
      await incrementPromoCodeRedemption(quoted.appliedCode).catch(() => undefined)
    }

    try {
      await releaseReservationsForOrder(cartHoldOrderId(session.user.id))
      const reservationItems = (data.items || []).map((item) => {
        const product = (item as {
          product?: { id?: string; digitalProduct?: boolean; instantDelivery?: boolean }
          isPreorder?: boolean
        }).product
        return {
          productId: item.productId || product?.id || '',
          quantity: item.quantity || 1,
          isPreorder: Boolean((item as { isPreorder?: boolean }).isPreorder),
          digitalProduct: Boolean(product?.digitalProduct),
          instantDelivery: Boolean(product?.instantDelivery),
        }
      }).filter((i) => i.productId)

      if (reservationItems.length > 0) {
        const { reserved, skipped } = await reserveInventoryForOrder(orderId, reservationItems)
        if (reserved.length > 0 || skipped.length > 0) {
          logger.info('Orders: inventory reserved', {
            orderId,
            reserved: reserved.length,
            skippedDigitalOrPreorder: skipped.length,
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
