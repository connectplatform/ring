import { NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { WalletConductor } from '@/features/wallet/conductor/wallet-conductor'

/**
 * GET /api/wallet/token/balance — native token balance via WalletConductor.
 */
export async function GET() {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await WalletConductor.getNativeBalance(session.user.id)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch native token balance'
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    console.error('GET /api/wallet/token/balance failed:', error)
    return NextResponse.json({ error: 'Failed to fetch native token balance' }, { status: 500 })
  }
}
