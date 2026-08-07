import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { getAdminRewardStats, type RewardStatsRange } from '@/lib/admin/reward-stats'

const RANGES = new Set<RewardStatsRange>(['7d', '28d', '90d'])

export async function GET(request: NextRequest) {
  await connection()

  const session = await auth()
  if (!session?.user || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const requestedRange = request.nextUrl.searchParams.get('range') as RewardStatsRange | null
    const range = requestedRange && RANGES.has(requestedRange) ? requestedRange : '28d'
    const stats = await getAdminRewardStats(range)
    return NextResponse.json({ success: true, range, stats })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load reward statistics' },
      { status: 500 },
    )
  }
}
