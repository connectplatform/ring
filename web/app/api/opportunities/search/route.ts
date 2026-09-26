import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { searchOpportunities, SearchOpportunitiesParams } from '@/features/opportunities/services'
import { parseOpportunityListQuery } from '@/features/opportunities/lib/opportunity-search-params'

export async function POST(request: NextRequest) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = (await request.json()) as SearchOpportunitiesParams
    const parsed = parseOpportunityListQuery(body as unknown as Record<string, unknown>)
    const results = await searchOpportunities({
      ...parsed,
      types: body.types ?? parsed.types,
      categories: body.categories ?? parsed.categories,
      query: body.query ?? parsed.query,
      startAfter: body.startAfter ?? parsed.startAfter,
      limit: body.limit ?? parsed.limit,
      sortBy: body.sortBy ?? parsed.sortBy,
      sortOrder: body.sortOrder ?? parsed.sortOrder,
    })

    return NextResponse.json(results)
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json(
      {
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const parsed = parseOpportunityListQuery(request.nextUrl.searchParams)
    const results = await searchOpportunities(parsed)
    return NextResponse.json(results)
  } catch (error) {
    console.error('Search API GET error:', error)
    return NextResponse.json(
      {
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
