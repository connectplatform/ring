/**
 * GET/POST /api/store/cart — session-bound server cart mirror.
 * Always binds session.user.id; ignores any body.userId.
 */

import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import {
  getServerCart,
  setServerCart,
  type ServerCartLine,
} from '@/features/store/services/server-cart'
import { logger } from '@/lib/logger'

export async function GET() {
  await connection()
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const cart = await getServerCart(session.user.id)
    return NextResponse.json({
      success: true,
      data: {
        items: cart.items.map((i) => ({ id: i.productId, qty: i.qty })),
        updatedAt: cart.updatedAt,
      },
    })
  } catch (error) {
    logger.warn('GET /api/store/cart failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to load cart' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  await connection()
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    // Security: ignore any client-supplied identity
    if (body?.userId || body?.uid || body?.asUserId) {
      logger.warn('POST /api/store/cart ignored model/client identity fields', {
        sessionUserId: session.user.id,
      })
    }

    const rawItems = Array.isArray(body?.items) ? body.items : []
    const items: ServerCartLine[] = rawItems
      .map((item: Record<string, unknown>) => ({
        productId: String(item.productId || item.id || ''),
        qty: Math.max(1, Math.floor(Number(item.qty ?? item.quantity ?? 1) || 1)),
      }))
      .filter((i: ServerCartLine) => Boolean(i.productId))

    const cart = await setServerCart(session.user.id, items)
    return NextResponse.json({
      success: true,
      data: {
        items: cart.items.map((i) => ({ id: i.productId, qty: i.qty })),
        updatedAt: cart.updatedAt,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save cart'
    logger.warn('POST /api/store/cart failed', { error: message })
    const status = message.toLowerCase().includes('insufficient') ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
