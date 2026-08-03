import { NextResponse, connection } from 'next/server'
import { requireOrderLabAccess, labAuthDenied } from '@/features/crm/lab/lab-auth'
import { OrderSourceService } from '@/features/crm/lab/order-source-service'
import { sourceErrorResponse } from '@/features/crm/lab/order-source-errors'

/** GET /api/my-jobs/[id]/source/commits — buyer/integrator/admin */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await connection()
  const { id } = await context.params
  const access = await requireOrderLabAccess(id, { allowBuyer: true })
  if (labAuthDenied(access)) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }
  const limitRaw = new URL(request.url).searchParams.get('limit')
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 30
  try {
    const commits = await OrderSourceService.listCommits(
      id,
      Number.isFinite(limit) ? limit : 30,
    )
    return NextResponse.json({ success: true, commits, role: access.role })
  } catch (err) {
    return sourceErrorResponse(err)
  }
}
