import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import {
  getWalletActivityFeed,
  type WalletActivityFeedFilter,
} from '@/features/wallet/services/wallet-activity-feed'
import { queryInt, queryString } from '@/lib/server/request'

const ALLOWED_FILTERS: WalletActivityFeedFilter[] = [
  'all',
  'credit',
  'chain',
  'incoming',
  'outgoing',
  'requests',
]

export async function GET(request: NextRequest) {
  await connection()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const filter = (queryString(request, 'filter') ?? 'all') as WalletActivityFeedFilter
  const limit = queryInt(request, 'limit', 50) ?? 50
  const walletAddress = queryString(request, 'walletAddress')

  if (!ALLOWED_FILTERS.includes(filter)) {
    return NextResponse.json({ error: 'Invalid filter' }, { status: 400 })
  }

  const rows = await getWalletActivityFeed(session.user.id, {
    filter,
    limit,
    walletAddress: walletAddress ?? undefined,
  })
  return NextResponse.json({ activities: rows, filter, limit })
}
