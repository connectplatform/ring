import { NextRequest, NextResponse, connection} from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { StoreOrdersService } from '@/features/store/services/orders-service'

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connection() // Next.js 16: opt out of prerendering

  const { id } = await context.params

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const order = await StoreOrdersService.getOrderById(id)
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const data: any = order
    if (data?.userId !== session.user.id && !isPlatformAdmin(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json(order)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}


