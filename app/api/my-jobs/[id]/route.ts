import { NextRequest, NextResponse, connection } from 'next/server'
import { z } from 'zod'
import { requireOrderLabAccess, labAuthDenied } from '@/features/crm/lab/lab-auth'
import { ProjectOrderService } from '@/features/crm/orders/project-order-service'
import { notifyProjectOrderProgress } from '@/features/crm/orders/notify'
import type { ProjectWorkStatus } from '@/features/crm/orders/types'

const INTEGRATOR_WORK_STATUSES = ['in_progress', 'completed', 'disputed'] as const

const patchSchema = z.object({
  progress: z.number().min(0).max(100).optional(),
  workStatus: z.enum(INTEGRATOR_WORK_STATUSES).optional(),
})

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection()
  const { id } = await context.params
  const access = await requireOrderLabAccess(id)
  if (labAuthDenied(access)) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }
  return NextResponse.json({ success: true, order: access.order })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection()
  const { id } = await context.params
  const access = await requireOrderLabAccess(id)
  if (labAuthDenied(access)) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }
  if (access.role === 'buyer') {
    return NextResponse.json({ error: 'Buyers cannot update job progress' }, { status: 403 })
  }

  const existing = access.order
  if (existing.workStatus === 'canceled') {
    return NextResponse.json({ error: 'Canceled orders cannot be updated' }, { status: 400 })
  }

  const body = patchSchema.safeParse(await request.json().catch(() => ({})))
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 })
  }
  if (body.data.progress === undefined && body.data.workStatus === undefined) {
    return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
  }

  let progress = typeof body.data.progress === 'number' ? body.data.progress : existing.progress
  let workStatus: ProjectWorkStatus = existing.workStatus

  if (body.data.workStatus) {
    workStatus = body.data.workStatus
  }

  if (workStatus === 'completed') {
    progress = 100
  } else if (
    typeof body.data.progress === 'number' &&
    (workStatus === 'new' || workStatus === 'available')
  ) {
    workStatus = 'in_progress'
  }

  const order = await ProjectOrderService.patch(id, { progress, workStatus })

  void notifyProjectOrderProgress({
    orderId: id,
    buyerUserId: order.userId,
    progress: order.progress,
    workStatus: order.workStatus,
  })

  return NextResponse.json({ success: true, order })
}
