import { NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { ProjectOrderService } from '@/features/crm/orders/project-order-service'
import { ProjectDeploymentService } from '@/features/crm/lab/deployment-service'
import { RING_EDGES } from '@/features/crm/lab/k8s-edge-client'

/**
 * GET /api/my-orders/[id] — owner (or admin) order + buyer-safe deploy summary (no env secrets).
 */
export async function GET(
  _request: Request,
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
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const admin = isPlatformAdmin(session.user.role)
  if (!admin && order.userId !== session.user.id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const dep = await ProjectDeploymentService.getByOrderId(id)
  const deploymentSummary = dep
    ? {
        edge: dep.edge,
        namespace: dep.namespace || null,
        projectName: dep.projectName || null,
        deploymentName: dep.deploymentName || null,
        projectUrl: dep.projectUrl || null,
        lastDeployAt: dep.lastDeployAt,
        lastDeployStatus: dep.lastDeployStatus,
        lastError: dep.lastDeployStatus === 'failed' ? dep.lastError : null,
      }
    : null

  return NextResponse.json({
    success: true,
    order,
    deployment: deploymentSummary,
    edgeLabels: RING_EDGES,
  })
}
