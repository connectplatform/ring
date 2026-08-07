import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { getMatcherAnalytics } from '@/features/admin/matcher/services/get-matcher-analytics'
import { parseMatcherTimeframe } from '@/features/admin/matcher/types/matcher-analytics'

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const timeframe = parseMatcherTimeframe(searchParams.get('timeframe') ?? undefined)

  try {
    const data = await getMatcherAnalytics(timeframe)
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load matcher analytics' },
      { status: 500 },
    )
  }
}
