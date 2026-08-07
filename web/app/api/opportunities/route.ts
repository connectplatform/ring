import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { getOpportunitiesForRole } from '@/features/opportunities/services/get-opportunities'
import { createOpportunity } from '@/features/opportunities/services/create-opportunity'
import { createOpportunityBodySchema } from '@/features/opportunities/lib/create-opportunity-schema'
import { resolveSessionUserRole } from '@/features/auth/user-role'
import {
  OpportunityAuthError,
  OpportunityPermissionError,
  OpportunityQueryError,
  OpportunityDatabaseError,
} from '@/lib/errors'
import { logger } from '@/lib/logger'
import { rateLimit, keyFromRequest } from '@/lib/rate-limit'
import { isFeatureEnabledOnServer } from '@/whitelabel/features'

/**
 * GET /api/opportunities — role-aware list (cursor pagination).
 * POST /api/opportunities — create (canonical REST; UI may still use Server Action).
 */

export async function GET(req: NextRequest) {
  await connection()

  try {
    const session = await auth()
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = resolveSessionUserRole(session.user.role)
    const searchParams = req.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const startAfter = searchParams.get('startAfter') || undefined

    const { opportunities, lastVisible } = await getOpportunitiesForRole({
      userRole,
      limit,
      startAfter,
    })

    return NextResponse.json(
      {
        opportunities,
        items: opportunities,
        lastVisible,
        cursor: lastVisible,
        hasMore: !!lastVisible,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      },
    )
  } catch (error) {
    logger.error('api.opportunities.list.error', {
      message: error instanceof Error ? error.message : String(error),
    })

    if (error instanceof Error) {
      if (error.message.includes('permission-denied') || error.message.includes('PERMISSION_DENIED')) {
        return NextResponse.json({ error: 'Access denied: Forbidden' }, { status: 403 })
      }
      if (error.message.includes('Unauthorized') || error.message.includes('UNAUTHORIZED')) {
        return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 })
      }
      const isDev = process.env.NODE_ENV === 'development'
      return NextResponse.json(
        {
          error: 'Unable to fetch opportunities: Internal Server Error',
          ...(isDev && { details: error.message }),
        },
        { status: 500 },
      )
    }

    return NextResponse.json({ error: 'Unable to fetch opportunities: Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  await connection()

  try {
    if (!isFeatureEnabledOnServer('opportunities')) {
      return NextResponse.json({ error: 'Feature disabled' }, { status: 404 })
    }

    const session = await auth()
    const key = keyFromRequest(req, session?.user?.id)
    const rl = rateLimit(key, 20, 60_000)
    if (!rl.ok) {
      return NextResponse.json({ error: 'Rate limit exceeded', resetAt: rl.resetAt }, { status: 429 })
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let raw: unknown
    try {
      raw = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const parsed = createOpportunityBodySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid opportunity data' },
        { status: 400 },
      )
    }

    const opportunity = await createOpportunity(
      parsed.data as Parameters<typeof createOpportunity>[0],
    )

    logger.info('api.opportunities.create.success', { opportunityId: opportunity.id })
    return NextResponse.json({ opportunity }, { status: 201 })
  } catch (error) {
    logger.error('api.opportunities.create.error', {
      message: error instanceof Error ? error.message : String(error),
    })

    if (error instanceof OpportunityAuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof OpportunityPermissionError) {
      return NextResponse.json({ error: error.message || 'Access denied' }, { status: 403 })
    }
    if (error instanceof OpportunityQueryError || error instanceof OpportunityDatabaseError) {
      return NextResponse.json(
        { error: error.message || 'Failed to create opportunity' },
        { status: 400 },
      )
    }

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
