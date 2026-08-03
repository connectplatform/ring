import { NextRequest, NextResponse, connection } from 'next/server'
import { z } from 'zod'
import { requireOrderLabAccess, labAuthDenied } from '@/features/crm/lab/lab-auth'
import { getOrCreateOrderLabConversation } from '@/features/crm/lab/order-lab-chat-service'
import { sendEnvRequest, cancelEnvRequest } from '@/features/crm/lab/env-request-service'
import { auth } from '@/auth'

const sendSchema = z.object({
  orderId: z.string().min(1),
  keys: z.array(z.string().min(1)).min(1),
  docsPath: z.string().optional(),
})

/**
 * POST /api/my-jobs/env-request — integrator/admin sends env_request into order_lab.
 */
export async function POST(request: NextRequest) {
  await connection()
  const body = sendSchema.safeParse(await request.json().catch(() => ({})))
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 })
  }
  const { orderId, keys, docsPath } = body.data
  const access = await requireOrderLabAccess(orderId)
  if (labAuthDenied(access)) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }
  if (access.role === 'buyer') {
    return NextResponse.json({ error: 'Buyers cannot request keys' }, { status: 403 })
  }

  const lab = await getOrCreateOrderLabConversation(orderId, {
    integratorId: access.order.integratorId,
    buyerId: access.order.userId,
    adminId: access.role === 'admin' ? access.userId : undefined,
  })

  const session = await auth()
  const name = session?.user?.name || 'Integrator'

  try {
    const result = await sendEnvRequest({
      orderId,
      conversationId: lab.id,
      requesterUserId: access.userId,
      requesterName: name,
      keys,
      docsPath,
    })
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Send failed' },
      { status: 400 },
    )
  }
}
