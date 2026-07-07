import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { listWallets } from '@/features/wallet/services/list-wallets'
import { refreshBalancesForUser } from '@/lib/wallet/wallet-balance-cache'
import { auth } from '@/auth'

/**
 * GET /api/wallet/list
 *
 * Lists all wallets for the authenticated user with balance info.
 *
 * Query params:
 *   ?refresh=true — force on-chain balance refresh (bypasses DB cache TTL).
 *                   Used when the user clicks the "Refresh" button.
 *
 * Response:
 *   200 { wallets: WalletInfo[] }
 *   401 { error: "Unauthorized" }
 *   500 { error: string }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  await connection() // Next.js 16: auth()/headers() requires dynamic opt-out

  try {
    const { searchParams } = request.nextUrl
    const forceRefresh = searchParams.get('refresh') === 'true'

    if (forceRefresh) {
      // Force-refresh: fetch on-chain, write to DB, return fresh
      const session = await auth()
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      await refreshBalancesForUser(session.user.id)
    }

    // listWallets uses the DB read-through cache — after a force-refresh,
    // it returns the freshly-persisted balances
    const wallets = await listWallets()

    return NextResponse.json({ wallets })
  } catch (error) {
    console.error('API: /api/wallet/list - Error occurred:', error)

    if (error instanceof Error) {
      switch (error.message) {
        case 'Unauthorized: Please log in to list wallets':
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        case 'User not found':
          return NextResponse.json({ error: 'User not found' }, { status: 404 })
        case 'Firestore instance is null':
          return NextResponse.json({ error: 'Database connection error' }, { status: 500 })
      }
    }

    return NextResponse.json({ error: 'Failed to fetch user wallets' }, { status: 500 })
  }
}

/**
 * Prevent HTTP-level caching — wallet data must be fresh.
 * The DB read-through cache (server-side) handles the actual freshness logic.
 */
