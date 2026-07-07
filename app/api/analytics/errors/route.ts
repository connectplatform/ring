/**
 * Analytics Errors API — client error ingestion + admin listing
 * 
 * Handles POST: Log analytics errors from client (optionally enriches with user ID if authenticated).
 * Handles GET: Allows platform admins to query/report analytics errors with optional filters (severity/component).
 */

import { NextRequest, NextResponse, connection, after } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { db } from '@/lib/database'
import {
  analyticsErrorPayloadSchema,
  insertAnalyticsErrors,
  isAnalyticsStorageDisabled,
} from '@/features/analytics/lib/analytics-db'

// Handles client POST requests to store analytics error entries in the database
export async function POST(request: NextRequest) {
  // Ensure DB connection (init if not already connected)
  await connection()

  try {
    // Parse and validate at the route layer (addresses TODO: structured validation)
    const raw = await request.json()
    const parsed = analyticsErrorPayloadSchema.safeParse(raw)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid error payload' },
        { status: 400 },
      )
    }

    // Check storage availability synchronously — avoids spinning up after() if disabled.
    const storageDisabled = isAnalyticsStorageDisabled()

    if (!storageDisabled) {
      // Defer DB write — respond immediately, error logging is non-blocking.
      // Auth and userId enrichment happen inside after() so the response is never held up.
      after(async () => {
        const session = await auth().catch(() => null)
        // Spread into a new object — never mutate the parsed body.
        const enrichedBody = session?.user?.id ? { ...raw, userId: session.user.id } : raw
        await insertAnalyticsErrors(enrichedBody).catch((err: unknown) =>
          console.error('[analytics/errors] background write failed:', err),
        )
      })
    }

    // Return immediately — the DB write is fire-and-forget.
    return NextResponse.json({
      success: true,
      storageSkipped: storageDisabled,
      message: storageDisabled
        ? 'Error log acknowledged (storage disabled)'
        : 'Errors recorded',
    })
  } catch (error) {
    // Log to server logs for debugging purposes
    console.error('[analytics/errors] POST failed:', error)
    // Respond with generic 500
    return NextResponse.json(
      { success: false, error: 'Failed to log error' },
      { status: 500 },
    )
  }
}

// Handles GET requests for error querying (admin only)
export async function GET(request: NextRequest) {
  // Ensure DB connection
  await connection()

  try {
    // Require authentication; fail early if not signed in
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      )
    }

    // Allow only platform admins to list errors (authorization)
    if (!isPlatformAdmin(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 },
      )
    }

    // Extract query parameters for filtering
    const searchParams = request.nextUrl.searchParams
    // Limit: return up to 100 results, capped; default to 50
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const severity = searchParams.get('severity') // error severity, optional
    const component = searchParams.get('component') // error source/component, optional

    // Build Firestore-style filter array if filters present
    const filters: Array<{ field: string; operator: string; value: unknown }> = []
    if (severity) filters.push({ field: 'severity', operator: '==', value: severity })
    if (component) filters.push({ field: 'component', operator: '==', value: component })

    // Execute DB query: get error docs, apply filters, order by creation date
    const result = await db().queryDocs({
      collection: 'analytics_errors',
      filters,
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      pagination: { limit: Math.min(limit, 100) },
    })

    // If storage fails, return error status
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch errors' },
        { status: 500 },
      )
    }

    // Success: return error entries and their count
    return NextResponse.json({
      success: true,
      errors: result.data ?? [],
      count: result.data?.length ?? 0,
    })
  } catch (error) {
    // Log any unexpected errors and return server error to client
    console.error('[Analytics Errors API] Failed to fetch errors:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch errors' },
      { status: 500 },
    )
  }
  // TODO: Consider next/server's built-in caching (revalidatePath) if GET is used in static contexts.
}
