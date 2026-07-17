import { NextRequest, NextResponse, connection } from 'next/server'
import { requireOrderLabAccess, labAuthDenied } from '@/features/crm/lab/lab-auth'
import { ProjectDeploymentService } from '@/features/crm/lab/deployment-service'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; pod: string }> },
) {
  await connection()
  const { id, pod } = await context.params
  const access = await requireOrderLabAccess(id)
  if (labAuthDenied(access)) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const tail = Number(request.nextUrl.searchParams.get('tail') || 500)
  try {
    const logs = await ProjectDeploymentService.getLogs(id, pod, Math.min(tail, 2000))
    return NextResponse.json({ success: true, logs })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch logs' },
      { status: 400 },
    )
  }
}
