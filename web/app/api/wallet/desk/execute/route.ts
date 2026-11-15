import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { DeskExecuteRequestSchema } from '@/lib/zod/desk-schemas'
import { WalletConductor } from '@/features/wallet/conductor/wallet-conductor'
import { getDeskExecuteErrorCode } from '@/features/wallet/chains/solana/desk-errors'
import { readJsonBody } from '@/lib/server/request'
import { logger } from '@/lib/logger'

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
    const result = await WalletConductor.executeDesk({
      userId: session.user.id,
      role: session.user.role,
      idempotencyKey: parsed.data.idempotencyKey,
      quoteToken: parsed.data.quoteToken,
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const typed = getDeskExecuteErrorCode(error)
    if (typed) {
      return NextResponse.json({ error: typed, code: typed }, { status: 400 })
    }

    const message = error instanceof Error ? error.message : 'Desk execution failed'
    logger.error('Desk execution failed', { message })

    const status =
      message.includes('Compliance') || message.includes('subscriber') ? 403 : 400
    const clientError = message.includes('Compliance')
      ? 'Compliance rejected'
      : message.includes('subscriber')
        ? 'Subscriber required'
        : 'DESK_EXECUTE_FAILED'
    return NextResponse.json({ error: clientError, code: clientError }, { status })
  }
}
