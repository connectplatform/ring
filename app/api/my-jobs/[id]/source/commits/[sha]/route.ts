import { NextResponse, connection } from 'next/server'
import { requireOrderLabAccess, labAuthDenied } from '@/features/crm/lab/lab-auth'
import { OrderSourceService } from '@/features/crm/lab/order-source-service'
import { sourceErrorResponse } from '@/features/crm/lab/order-source-errors'

/** GET /api/my-jobs/[id]/source/commits/[sha] — buyer/integrator/admin */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; sha: string }> },
) {
  await connection()
  const { id, sha } = await context.params
  const access = await requireOrderLabAccess(id, { allowBuyer: true })
  if (labAuthDenied(access)) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }
  try {
    const commit = await OrderSourceService.getCommit(id, sha)
    return NextResponse.json({ success: true, commit, role: access.role })
  } catch (err) {
    return sourceErrorResponse(err)
  }
}
