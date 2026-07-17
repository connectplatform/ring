import { NextResponse, connection } from 'next/server'
import { requireOrderLabAccess, labAuthDenied } from '@/features/crm/lab/lab-auth'
import {
  getOrCreateCustomerConversation,
  getOrCreateOrderLabConversation,
} from '@/features/crm/lab/order-lab-chat-service'
import { resolveCrmUserChips } from '@/features/crm/orders/resolve-users'

/**
 * GET /api/my-jobs/[id]/chat
 * Bootstrap shared project room (order_lab) for buyer/integrator/admin.
 * Admins also get private DMs with client and integrator.
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

  const { order, userId, role } = access
  const chips = await resolveCrmUserChips(
    [order.userId, order.integratorId].filter(Boolean) as string[],
  )

  const lab = await getOrCreateOrderLabConversation(id, {
    integratorId: order.integratorId,
    buyerId: order.userId,
    adminId: role === 'admin' ? userId : undefined,
  })

  const payload: Record<string, unknown> = {
    success: true,
    labConversationId: lab.id,
    /** @deprecated use labConversationId — shared project room */
    orderLabConversationId: lab.id,
    buyerUserId: order.userId,
    integratorUserId: order.integratorId,
    role,
  }

  if (role === 'admin') {
    const clientDm = await getOrCreateCustomerConversation(
      userId,
      order.userId,
      chips[order.userId]?.name,
    )
    payload.clientDmId = clientDm.id
    /** @deprecated alias for AdminCrmCustomerChat migration */
    payload.customerConversationId = clientDm.id

    if (order.integratorId) {
      const integratorDm = await getOrCreateCustomerConversation(
        userId,
        order.integratorId,
        chips[order.integratorId]?.name,
      )
      payload.integratorDmId = integratorDm.id
    }
  }

  return NextResponse.json(payload)
}
