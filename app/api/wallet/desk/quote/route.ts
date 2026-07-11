import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { DeskQuoteRequestSchema } from '@/lib/zod/desk-schemas'
import { WalletConductor } from '@/features/wallet/conductor/wallet-conductor'
import { queryString } from '@/lib/server/request'

export async function GET(request: NextRequest) {
  await connection()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = DeskQuoteRequestSchema.safeParse({
    side: queryString(request, 'side'),
    amount: queryString(request, 'amount'),
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const quote = await WalletConductor.quoteDesk({
      userId: session.user.id,
      role: session.user.role,
      side: parsed.data.side,
      amount: parsed.data.amount,
    })
    return NextResponse.json(quote)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Quote failed'
    const status = message.includes('subscriber') ? 403 : 400
    return NextResponse.json(
      {
        error: message,
        code: status === 403 ? 'DESK_SUBSCRIBER_REQUIRED' : undefined,
      },
      { status },
    )
  }
}
