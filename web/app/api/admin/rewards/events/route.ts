import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { listAdminRewardEvents } from '@/lib/admin/reward-stats'

function numberParam(value: string | null, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function GET(request: NextRequest) {
  await connection()

  const session = await auth()
  if (!session?.user || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = request.nextUrl
    const result = await listAdminRewardEvents({
      limit: Math.min(Math.max(1, numberParam(searchParams.get('limit'), 50)), 200),
      offset: Math.max(0, numberParam(searchParams.get('offset'), 0)),
      trigger: searchParams.get('trigger') || undefined,
      status: searchParams.get('status') || undefined,
      userId: searchParams.get('userId') || undefined,
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load reward events' },
      { status: 500 },
    )
  }
}
