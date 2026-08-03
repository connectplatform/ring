/**
 * POST /api/store/cart/hold
 * Wave 1: authenticated cart soft-holds (5-min TTL). Guests are no-ops (401).
 */

import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { syncCartSoftHolds } from '@/features/store/services/inventory-sync'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const items = Array.isArray(body?.items) ? body.items : []

    const normalized = items
      .map((item: Record<string, unknown>) => {
        const product = (item.product as Record<string, unknown> | undefined) || {}
        return {
          productId: String(item.productId || product.id || ''),
          quantity: Number(item.quantity || 1),
          isPreorder: Boolean(item.isPreorder),
          digitalProduct: Boolean(product.digitalProduct ?? item.digitalProduct),
          instantDelivery: Boolean(product.instantDelivery ?? item.instantDelivery),
        }
      })
      .filter((i: { productId: string }) => Boolean(i.productId))

    const result = await syncCartSoftHolds(session.user.id, normalized)
    logger.info('Cart soft-hold synced', {
      userId: session.user.id,
      reserved: result.reserved.length,
      skipped: result.skipped.length,
      released: result.released,
    })

    return NextResponse.json({
      reserved: result.reserved.length,
      skipped: result.skipped.length,
      released: result.released,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cart hold failed'
    logger.warn('Cart soft-hold failed', { error: message })
    const status = message.toLowerCase().includes('insufficient') ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
