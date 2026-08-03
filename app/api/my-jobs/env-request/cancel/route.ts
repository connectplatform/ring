import { NextRequest, NextResponse, connection } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { cancelEnvRequest } from '@/features/crm/lab/env-request-service'

const schema = z.object({ messageId: z.string().min(1) })

/** POST /api/my-jobs/env-request/cancel — requester cancels pending env_request */
export async function POST(request: NextRequest) {
  await connection()
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    await cancelEnvRequest({
      messageId: parsed.data.messageId,
      actorUserId: session.user.id,
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Cancel failed' },
      { status: 400 },
    )
  }
}
