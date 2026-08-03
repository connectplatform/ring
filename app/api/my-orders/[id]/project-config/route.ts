import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { ProjectOrderService } from '@/features/crm/orders/project-order-service'
import { OrderProjectConfigService } from '@/features/crm/orders/order-project-config-service'

/**
 * GET/PATCH /api/my-orders/[id]/project-config — buyer vital mask (admin full).
 */
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
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const admin = isPlatformAdmin(session.user.role)
  if (!admin && order.userId !== session.user.id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }
  const projectConfig = await OrderProjectConfigService.get(id)
  return NextResponse.json({ success: true, projectConfig, role: admin ? 'admin' : 'buyer' })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection()
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const { id } = await context.params
  const order = await ProjectOrderService.getById(id)
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const admin = isPlatformAdmin(session.user.role)
  if (!admin && order.userId !== session.user.id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const projectConfig = await OrderProjectConfigService.patch(
      id,
      body.projectConfig ?? body,
      admin ? 'admin' : 'buyer',
    )
    return NextResponse.json({
      success: true,
      projectConfig,
      appliedOnNextDeploy: true,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Save failed' },
      { status: 400 },
    )
  }
}
