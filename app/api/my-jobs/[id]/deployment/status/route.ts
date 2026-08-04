import { NextResponse, connection } from 'next/server'
import { requireOrderLabAccess, labAuthDenied } from '@/features/crm/lab/lab-auth'
import { ProjectDeploymentService } from '@/features/crm/lab/deployment-service'

/**
 * Consolidated Order Lab status for hero + tab chips.
 * Server-side clone /api/health probe (avoids browser CORS).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await connection()
  const { id } = await context.params
  const access = await requireOrderLabAccess(id, { allowBuyer: true })
  if (labAuthDenied(access)) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  try {
    const summary = await ProjectDeploymentService.getStatusSummary(id)
    return NextResponse.json({ success: true, ...summary })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load deployment status',
      },
      { status: 400 },
    )
  }
}
