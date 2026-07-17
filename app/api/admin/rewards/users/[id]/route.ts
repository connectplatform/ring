import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { listAdminRewardEvents } from '@/lib/admin/reward-stats'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection()

  const session = await auth()
  if (!session?.user || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: userId } = await context.params
  if (!userId) {
    return NextResponse.json({ error: 'User id required' }, { status: 400 })
  }

  try {
    const { getUserRewardCreditAddEventSummary } = await import(
      '@/lib/wallet/reward-credit-service'
    )
    const [summary, recent] = await Promise.all([
      getUserRewardCreditAddEventSummary(userId),
      listAdminRewardEvents({ userId, limit: 50 }),
    ])

    return NextResponse.json({
      success: true,
      userId,
      summary,
      events: recent.events,
      total: recent.total,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load user rewards' },
      { status: 500 },
    )
  }
}
