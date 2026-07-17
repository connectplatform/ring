import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { getMyOpportunities } from '@/features/opportunities/services/get-user-opportunities'
import type { MyOpportunitiesView } from '@/features/opportunities/lib/lifecycle-status'

const VIEWS = new Set<MyOpportunitiesView>(['all', 'drafts', 'pending', 'active', 'archived'])

export async function GET(request: NextRequest) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 1), 100)
    const startAfter =
      url.searchParams.get('startAfter') || url.searchParams.get('afterId') || undefined
    const viewParam = (url.searchParams.get('view') || 'all') as MyOpportunitiesView
    const view = VIEWS.has(viewParam) ? viewParam : 'all'

    const result = await getMyOpportunities(view, limit, startAfter)

    return NextResponse.json({
      items: result.opportunities,
      opportunities: result.opportunities,
      cursor: result.lastVisible,
      lastVisible: result.lastVisible,
      hasMore: Boolean(result.lastVisible),
      lifecycleCounts: result.lifecycleCounts,
      counts: result.counts,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load opportunities'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
