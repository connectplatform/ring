import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { searchOpportunities, SearchOpportunitiesParams } from '@/features/opportunities/services'

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse search parameters from request body
    const body: SearchOpportunitiesParams = await request.json()

    // Add user context to search parameters
    const searchParams: SearchOpportunitiesParams = {
      ...body,
      userRole: session.user.role,
      userId: session.user.id
    }

    // Execute search
    const results = await searchOpportunities(searchParams)

    return NextResponse.json(results)
  } catch (error) {
    console.error('Search API error:', error)

    return NextResponse.json(
      {
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Handle GET requests (for simple text search)
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const types = searchParams.get('types')?.split(',') || undefined
    const categories = searchParams.get('categories')?.split(',') || undefined
    const location = searchParams.get('location') || undefined
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      )
    }

    // Execute search
    const results = await searchOpportunities({
      query,
      types,
      categories,
      location,
      limit,
      sortBy: 'relevance',
      userRole: session.user.role,
      userId: session.user.id
    })

    return NextResponse.json(results)
  } catch (error) {
    console.error('Search API GET error:', error)

    return NextResponse.json(
      {
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
