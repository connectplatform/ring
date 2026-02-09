import { NextRequest, NextResponse, connection} from 'next/server'
import { auth } from '@/auth'
import { orderCreateSchema } from '@/lib/zod'
import { StoreOrdersService } from '@/features/store/services/orders-service'

export async function GET(req: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = new URL(req.url)
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 1), 100)
    const startAfter = url.searchParams.get('afterId') || undefined
    const { items, lastVisible } = await StoreOrdersService.listOrdersForUser(session.user.id, { limit, startAfter })
    return NextResponse.json({ items, lastVisible })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

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
    const { orderId } = await StoreOrdersService.createOrder(session.user.id, parsed.data)
    return NextResponse.json({ orderId })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}


