import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import { isPlatformAdmin } from '@/features/auth/user-role'
import {
  ProjectOrderService,
  publishProjectOrderOpportunity,
} from '@/features/crm/orders/project-order-service'
import { cancelAndRefundProjectOrder } from '@/features/crm/orders/cancel-refund'
import {
  notifyProjectOrderAssigned,
  notifyProjectOrderAvailable,
  notifyProjectOrderRefunded,
} from '@/features/crm/orders/notify'

const patchSchema = z.object({
  workStatus: z
    .enum(['new', 'available', 'in_progress', 'completed', 'disputed', 'canceled'])
    .optional(),
  progress: z.number().min(0).max(100).optional(),
  integratorId: z.string().nullable().optional(),
  cancelAndRefund: z.boolean().optional(),
})

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection()
  const session = await auth()
  if (!session?.user?.id || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Admin required' }, { status: 403 })
  }

  const { id } = await context.params
  const order = await ProjectOrderService.getById(id)
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, order })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection()
  const session = await auth()
  if (!session?.user?.id || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Admin required' }, { status: 403 })
  }

  const { id } = await context.params
  const body = patchSchema.parse(await request.json())

  if (body.cancelAndRefund) {
    const result = await cancelAndRefundProjectOrder(id)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    const order = await ProjectOrderService.getById(id)
    if (order) {
      void notifyProjectOrderRefunded({ orderId: id, buyerUserId: order.userId })
    }
    return NextResponse.json({ success: true, order })
  }

  let order = await ProjectOrderService.getById(id)
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (typeof body.progress === 'number') {
    order = await ProjectOrderService.patch(id, { progress: body.progress })
  }

  if (body.integratorId !== undefined) {
    if (body.integratorId) {
      order = await ProjectOrderService.assignIntegrator(id, body.integratorId)
      void notifyProjectOrderAssigned({
        orderId: id,
        integratorUserId: body.integratorId,
        buyerUserId: order.userId,
      })
    } else {
      order = await ProjectOrderService.patch(id, { integratorId: null })
    }
  }

  if (body.workStatus) {
    if (body.workStatus === 'available') {
      if (order.paymentStatus !== 'paid') {
        return NextResponse.json(
          { error: 'Order must be paid before setting available' },
          { status: 400 },
        )
      }
      const opportunityId = await publishProjectOrderOpportunity(order, session.user.id)
      order = await ProjectOrderService.patch(id, {
        workStatus: 'available',
        opportunityId,
      })
      void notifyProjectOrderAvailable({
        orderId: id,
        buyerUserId: order.userId,
        opportunityId,
      })
    } else if (body.workStatus === 'canceled') {
      const result = await cancelAndRefundProjectOrder(id)
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      order = (await ProjectOrderService.getById(id))!
      void notifyProjectOrderRefunded({ orderId: id, buyerUserId: order.userId })
    } else if (body.workStatus === 'in_progress' && order.integratorId) {
      order = await ProjectOrderService.assignIntegrator(id, order.integratorId)
    } else {
      order = await ProjectOrderService.setWorkStatus(id, body.workStatus as any)
    }
  }

  return NextResponse.json({ success: true, order })
}
