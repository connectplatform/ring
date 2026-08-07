import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { hasMemberPrivileges, parseUserRolesArray } from '@/features/auth/user-role'
import { updateOpportunity } from '@/features/opportunities/services/update-opportunity'
import { getOpportunityById } from '@/features/opportunities/services/get-opportunity-by-id'

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection()
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const role = parseUserRolesArray(session.user.role)
  if (!role || !hasMemberPrivileges(role)) {
    return NextResponse.json({ error: 'Member role required' }, { status: 403 })
  }

  // Soft CRM — Layer1 stub or overlay full Order Lab services
  let ProjectOrderService: typeof import('@/features/crm/orders/project-order-service').ProjectOrderService
  let notifyProjectOrderRequested: typeof import('@/features/crm/orders/notify').notifyProjectOrderRequested
  try {
    ;({ ProjectOrderService } = await import('@/features/crm/orders/project-order-service'))
    ;({ notifyProjectOrderRequested } = await import('@/features/crm/orders/notify'))
  } catch {
    return NextResponse.json(
      { error: 'Project order CRM is not available on this build' },
      { status: 501 },
    )
  }

  const { id: opportunityId } = await context.params
  const opportunity = await getOpportunityById(opportunityId)
  if (!opportunity) {
    return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
  }

  const type = String(opportunity.type || '').toLowerCase()
  const projectOrderId = (opportunity as { projectOrderId?: string }).projectOrderId
  const isActive = (opportunity as { isActive?: boolean }).isActive !== false
  const status = String((opportunity as { status?: string }).status || 'active').toLowerCase()

  if (type !== 'ring_customization' || !projectOrderId) {
    return NextResponse.json(
      { error: 'Requests are only allowed for linked ring customization project orders' },
      { status: 400 },
    )
  }

  if (!isActive || status === 'closed' || status === 'filled') {
    return NextResponse.json({ error: 'This opportunity is no longer accepting requests' }, { status: 400 })
  }

  const order = await ProjectOrderService.getById(projectOrderId)
  if (!order || order.workStatus !== 'available') {
    return NextResponse.json({ error: 'Order is not available for requests' }, { status: 400 })
  }

  const rawApplicants = (opportunity as unknown as { applicants?: unknown }).applicants
  const applicants: string[] = Array.isArray(rawApplicants)
    ? rawApplicants.map(String)
    : []

  if (!applicants.includes(session.user.id)) {
    applicants.push(session.user.id)
    await updateOpportunity(opportunityId, {
      applicants,
      applicantCount: applicants.length,
    } as Parameters<typeof updateOpportunity>[1])
  }

  await ProjectOrderService.appendRequestor(projectOrderId, session.user.id)
  void notifyProjectOrderRequested({
    orderId: projectOrderId,
    buyerUserId: order.userId,
    requestorUserId: session.user.id,
    opportunityId,
  })

  return NextResponse.json({
    success: true,
    applicants,
    applicantCount: applicants.length,
    projectOrderId,
  })
}
