import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { ProjectOrderService } from '@/features/crm/orders/project-order-service'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection()
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { id } = await context.params
  const order = await ProjectOrderService.getById(id)
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const isOwner = order.userId === session.user.id
  const isIntegrator = order.integratorId === session.user.id
  const isAdmin = isPlatformAdmin(session.user.role)
  if (!isOwner && !isIntegrator && !isAdmin) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  return NextResponse.json({ success: true, order })
}
