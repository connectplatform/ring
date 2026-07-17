import { NextResponse, connection } from 'next/server'
import { requireOrderLabAccess, labAuthDenied } from '@/features/crm/lab/lab-auth'
import { ProjectDeploymentService } from '@/features/crm/lab/deployment-service'
import { notifyProjectOrderProgress } from '@/features/crm/orders/notify'

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await connection()
  const { id } = await context.params
  const access = await requireOrderLabAccess(id)
  if (labAuthDenied(access)) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }
  if (access.role === 'buyer') {
    return NextResponse.json({ error: 'Buyers cannot deploy' }, { status: 403 })
  }

  const dep = await ProjectDeploymentService.applyAndDeploy(id)
  if (dep.lastDeployStatus === 'success') {
    void notifyProjectOrderProgress({
      orderId: id,
      buyerUserId: access.order.userId,
      progress: access.order.progress,
      workStatus: access.order.workStatus,
    })
  }

  return NextResponse.json({
    success: dep.lastDeployStatus === 'success',
    ...ProjectDeploymentService.toMasked(dep),
    error: dep.lastError,
  }, { status: dep.lastDeployStatus === 'success' ? 200 : 400 })
}
