import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { DeskExecuteRequestSchema } from '@/lib/zod/desk-schemas'
import { executeDesk } from '@/features/wallet/chains/solana/desk-service'
import { readJsonBody } from '@/lib/server/request'

export async function POST(request: NextRequest) {
  await connection()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await readJsonBody(request)
  const parsed = DeskExecuteRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const result = await executeDesk({
      userId: session.user.id,
      idempotencyKey: parsed.data.idempotencyKey,
      quoteToken: parsed.data.quoteToken,
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Desk execution failed'
    const status = message.includes('Compliance') ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
