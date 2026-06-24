/**
 * Analytics Errors API — client error ingestion + admin listing
 */

import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { db } from '@/lib/database'
import { insertAnalyticsErrors } from '@/features/analytics/lib/analytics-db'

export async function POST(request: NextRequest) {
  await connection()

  try {
    const session = await auth().catch(() => null)
    const payload = await request.json()

    if ('errors' in payload && session?.user?.id) {
      payload.userId = session.user.id
    } else if (session?.user?.id && !payload.userId) {
      payload.userId = session.user.id
    }

    const { inserted, skipped } = await insertAnalyticsErrors(payload)

    return NextResponse.json({
      success: true,
      inserted,
      storageSkipped: skipped,
      message: 'Error logged successfully',
    })
  } catch (error) {
    console.error('[Analytics Errors API] Failed to log error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to log error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: error instanceof Error && error.message.includes('Invalid') ? 400 : 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      )
    }

    if (!isPlatformAdmin(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 },
      )
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const severity = searchParams.get('severity')
    const component = searchParams.get('component')

    const filters: Array<{ field: string; operator: string; value: unknown }> = []
    if (severity) filters.push({ field: 'severity', operator: '==', value: severity })
    if (component) filters.push({ field: 'component', operator: '==', value: component })

    const result = await db().queryDocs({
      collection: 'analytics_errors',
      filters,
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      pagination: { limit: Math.min(limit, 100) },
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch errors' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      errors: result.data ?? [],
      count: result.data?.length ?? 0,
    })
  } catch (error) {
    console.error('[Analytics Errors API] Failed to fetch errors:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch errors' },
      { status: 500 },
    )
  }
}
