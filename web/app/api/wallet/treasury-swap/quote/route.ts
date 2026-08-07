import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { TreasurySwapQuoteRequestSchema } from '@/lib/zod/treasury-swap-schemas'
import { WalletConductor } from '@/features/wallet/conductor/wallet-conductor'
import { queryString, readJsonBody } from '@/lib/server/request'

async function handleQuote(body: unknown) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = TreasurySwapQuoteRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const quote = await WalletConductor.quoteTreasurySwap({
      userId: session.user.id,
      role: session.user.role,
      fromTokenAddress: parsed.data.fromTokenAddress,
      amountIn: parsed.data.amountIn,
      signInAddress: parsed.data.signInAddress,
    })
    return NextResponse.json(quote)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Quote failed'
    const status = message.includes('subscriber') ? 403 : 400
    return NextResponse.json(
      {
        error: message,
        code: status === 403 ? 'TREASURY_SWAP_SUBSCRIBER_REQUIRED' : undefined,
      },
      { status },
    )
  }
}

export async function GET(request: NextRequest) {
  await connection()
  return handleQuote({
    fromTokenAddress: queryString(request, 'fromTokenAddress'),
    amountIn: queryString(request, 'amountIn'),
    signInAddress: queryString(request, 'signInAddress'),
  })
}

export async function POST(request: NextRequest) {
  await connection()
  const body = await readJsonBody(request)
  return handleQuote(body)
}
