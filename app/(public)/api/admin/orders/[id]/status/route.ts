import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { z } from 'zod'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const schema = z.object({ status: z.enum(['new', 'paid', 'processing', 'shipped', 'completed', 'canceled']) })
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    await StoreOrdersService.adminUpdateOrderStatus(params.id, parsed.data.status)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}


