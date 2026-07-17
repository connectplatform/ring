import { NextResponse, connection } from 'next/server'
import { requireOrderLabAccess, labAuthDenied } from '@/features/crm/lab/lab-auth'
import { ProjectDeploymentService } from '@/features/crm/lab/deployment-service'

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; pod: string }> },
) {
  await connection()
  const { id, pod } = await context.params
  const access = await requireOrderLabAccess(id)
  if (labAuthDenied(access)) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  try {
    await ProjectDeploymentService.restartPod(id, pod)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to restart pod' },
      { status: 400 },
    )
  }
}
