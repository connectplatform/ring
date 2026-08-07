import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { DeskExecuteRequestSchema } from '@/lib/zod/desk-schemas'
import { WalletConductor } from '@/features/wallet/conductor/wallet-conductor'
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
    const result = await WalletConductor.executeDesk({
      userId: session.user.id,
      role: session.user.role,
      idempotencyKey: parsed.data.idempotencyKey,
      quoteToken: parsed.data.quoteToken,
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Desk execution failed'
    if (
      message === 'INSUFFICIENT_CREDIT' ||
      (error as { code?: string })?.code === 'INSUFFICIENT_CREDIT'
    ) {
      return NextResponse.json(
        { error: 'INSUFFICIENT_CREDIT', code: 'INSUFFICIENT_CREDIT' },
        { status: 400 },
      )
    }
    const status =
      message.includes('Compliance') || message.includes('subscriber') ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
