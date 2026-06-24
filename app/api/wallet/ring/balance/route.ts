import { NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { getRingBalanceForUser } from '@/features/wallet/chains/ring-transfer-service'

export async function GET() {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await getRingBalanceForUser(session.user.id)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch RING balance'
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    console.error('GET /api/wallet/ring/balance failed:', error)
    return NextResponse.json({ error: 'Failed to fetch RING balance' }, { status: 500 })
  }
}
