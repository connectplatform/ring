import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { StoreOrdersService } from '@/features/store/services/orders-service'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const order = await StoreOrdersService.getOrderById(params.id)
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const data: any = order
    if (data?.userId !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json(order)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}


