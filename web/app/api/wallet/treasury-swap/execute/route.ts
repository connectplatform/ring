import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { TreasurySwapExecuteRequestSchema } from '@/lib/zod/treasury-swap-schemas'
import { WalletConductor } from '@/features/wallet/conductor/wallet-conductor'
import { readJsonBody } from '@/lib/server/request'

export async function POST(request: NextRequest) {
  await connection()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await readJsonBody(request)
  const parsed = TreasurySwapExecuteRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const result = await WalletConductor.executeTreasurySwap({
      userId: session.user.id,
      role: session.user.role,
      quoteToken: parsed.data.quoteToken,
      depositTxHash: parsed.data.depositTxHash as `0x${string}`,
      signInAddress: parsed.data.signInAddress,
    })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Treasury swap failed'
    const status =
      message.includes('Compliance') || message.includes('subscriber') ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
