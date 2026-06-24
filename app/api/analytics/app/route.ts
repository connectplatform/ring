import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import {
  appAnalyticsBatchSchema,
  insertAnalyticsEventBatch,
  isAnalyticsStorageDisabled,
} from '@/features/analytics/lib/analytics-db'

/**
 * POST /api/analytics/app
 * Batched client telemetry from app-analytics.js
 */
export async function POST(request: NextRequest) {
  await connection()

  try {
    const session = await auth().catch(() => null)
    const raw = await request.json()
    const parsed = appAnalyticsBatchSchema.safeParse(raw)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid payload' },
        { status: 400 },
      )
    }

    const userId = session?.user?.id ?? parsed.data.userId ?? null
    const { inserted, skipped } = await insertAnalyticsEventBatch(
      parsed.data.sessionId,
      userId,
      parsed.data.events,
    )

    return NextResponse.json({
      success: true,
      inserted,
      storageSkipped: skipped || isAnalyticsStorageDisabled(),
    })
  } catch (error) {
    console.error('[analytics/app] POST failed:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to store analytics events' },
      { status: 500 },
    )
  }
}
