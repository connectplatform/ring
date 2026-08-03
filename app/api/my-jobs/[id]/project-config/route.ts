import { NextRequest, NextResponse, connection } from 'next/server'
import { requireOrderLabAccess, labAuthDenied } from '@/features/crm/lab/lab-auth'
import { OrderProjectConfigService } from '@/features/crm/orders/order-project-config-service'

/**
 * GET/PATCH /api/my-jobs/[id]/project-config — integrator/admin full allowlist.
 */
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
  if (access.role === 'buyer') {
    return NextResponse.json({ error: 'Use /api/my-orders/[id]/project-config' }, { status: 403 })
  }
  const projectConfig = await OrderProjectConfigService.get(id)
  return NextResponse.json({ success: true, projectConfig, role: access.role })
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
    return NextResponse.json({ error: 'Buyers cannot use this route' }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const projectConfig = await OrderProjectConfigService.patch(
      id,
      body.projectConfig ?? body,
      access.role === 'admin' ? 'admin' : 'integrator',
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
