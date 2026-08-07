import { NextRequest, NextResponse, connection, after } from 'next/server'
import { auth } from '@/auth'
import {
  appAnalyticsBatchSchema,
  insertAnalyticsEventBatch,
  isAnalyticsStorageDisabled,
} from '@/features/analytics/lib/analytics-db'

/**
 * POST /api/analytics/app
 * Handles batched client telemetry sent from app-analytics.js.
 * Expects a payload conforming to appAnalyticsBatchSchema.
 */
export async function POST(request: NextRequest) {
  // Ensure database connection is established before handling request.
  await connection()

  try {
    // Attempt to parse and validate the incoming JSON body.
    const raw = await request.json()
    const parsed = appAnalyticsBatchSchema.safeParse(raw)

    if (!parsed.success) {
      // If validation fails, respond with first error message or generic message.
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid payload' },
        { status: 400 },
      )
    }

    // Check storage availability synchronously — avoids spinning up after() if disabled.
    const storageDisabled = isAnalyticsStorageDisabled()

    if (!storageDisabled) {
      // Defer DB write — respond immediately, analytics are non-blocking.
      // Auth is resolved inside after() so the response is never held up.
      after(async () => {
        const session = await auth().catch(() => null)
        const userId = session?.user?.id ?? parsed.data.userId ?? null

        await insertAnalyticsEventBatch(
          parsed.data.sessionId,
          userId,
          parsed.data.events,
        ).catch((err: unknown) =>
          console.error('[analytics/app] background write failed:', err),
        )
      })
    }

    // Return a success response immediately — the DB write is fire-and-forget.
    return NextResponse.json({
      success: true,
      storageSkipped: storageDisabled,
    })
  } catch (error) {
    // Log any unexpected error to server log for debugging.
    console.error('[analytics/app] POST failed:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to store analytics events' },
      { status: 500 },
    )
  }
}

// TODO: Consider using the new Next.js 16 middleware pattern for request validation and authentication, 
// to avoid per-request logic repetition and improve readability.
// TODO: If React 19/Next 16 introduces better error serialization or type-safe routing, prefer those for improved DX.