import { NextRequest, NextResponse, connection, after } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { db } from '@/lib/database'
import {
  insertWebVitalsRecord,
  isAnalyticsStorageDisabled,
  webVitalsPayloadSchema,
} from '@/features/analytics/lib/analytics-db'

// Pure helpers — platform and browser detection from User-Agent.

function getUserPlatform(userAgent: string): string {
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'iOS'
  if (/Android/.test(userAgent)) return 'Android'
  if (/Windows/.test(userAgent)) return 'Windows'
  if (/Macintosh/.test(userAgent)) return 'macOS'
  if (/Linux/.test(userAgent)) return 'Linux'
  return 'Unknown'
}

function getUserBrowser(userAgent: string): string {
  if (/Chrome/.test(userAgent)) return 'Chrome'
  if (/Firefox/.test(userAgent)) return 'Firefox'
  if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) return 'Safari'
  if (/Edge/.test(userAgent)) return 'Edge'
  return 'Unknown'
}

type WebVitalRating = 'good' | 'needs-improvement' | 'poor'

/** Weighted performance score from web-vital ratings (0–100). */
function calculatePerformanceScore(
  metrics: Array<{ name: string; rating?: WebVitalRating }>,
): number {
  const weights: Record<string, number> = {
    CLS: 0.15,
    FID: 0.25,
    LCP: 0.25,
    FCP: 0.15,
    TTFB: 0.2,
    INP: 0.25,
  }

  let totalScore = 0
  let totalWeight = 0

  for (const metric of metrics) {
    const weight = weights[metric.name] ?? 0
    if (!weight) continue
    let score = 0
    switch (metric.rating) {
      case 'good':
        score = 100
        break
      case 'needs-improvement':
        score = 50
        break
      case 'poor':
        score = 0
        break
      default:
        score = 75
    }
    totalScore += score * weight
    totalWeight += weight
  }

  return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0
}

// ---------------------------------------------------------------------------
// Input schema with Zod preprocess — handles 3 wire formats transparently
// and validates the canonical shape in one step.
// ---------------------------------------------------------------------------

/**
 * Normalize raw JSON body into the canonical shape expected by
 * `webVitalsPayloadSchema`.  The output is validated by Zod, so internal
 * type narrowing here is acceptable — any mismatch is caught downstream.
 */
function normalizeWebVitalsInput(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const body = raw as Record<string, unknown>

  // 1. Single-metric wrapper: { type: "single-metric", metric: { name, value, … } }
  if (body.type === 'single-metric' && body.metric && typeof body.metric === 'object') {
    const m = body.metric as Record<string, unknown>
    return {
      sessionId: String(m.sessionId ?? `session_${Date.now()}`),
      metrics: [m],
      url: String(m.url ?? ''),
      userAgent: String(m.userAgent ?? ''),
      timestamp: (body.timestamp as number | undefined) ?? Date.now(),
      userId: body.userId ?? null,
    }
  }

  // 2. Batch-report wrapper: { type: "batch-report", report: { sessionId, metrics, … } }
  if (body.type === 'batch-report' && body.report && typeof body.report === 'object') {
    const r = body.report as Record<string, unknown>
    return {
      sessionId: String(r.sessionId ?? `session_${Date.now()}`),
      metrics: Array.isArray(r.metrics) ? r.metrics : [],
      url: String(r.url ?? ''),
      userAgent: String(r.userAgent ?? ''),
      timestamp: (body.timestamp as number | undefined) ?? Date.now(),
      userId: body.userId ?? null,
    }
  }

  // 3. Raw next/web-vitals metric (no type wrapper) — what web-vitals-provider.tsx sends
  if (typeof body.name === 'string' && typeof body.value === 'number') {
    return {
      sessionId: String(body.sessionId ?? `session_${Date.now()}`),
      metrics: [body],
      url: String(body.url ?? ''),
      userAgent: String(body.userAgent ?? ''),
      timestamp: (body.timestamp as number | undefined) ?? Date.now(),
      userId: body.userId ?? null,
    }
  }

  // 4. Pass-through — assume already canonical; schema validation catches mismatches
  return body
}

const webVitalsInputSchema = z.preprocess(normalizeWebVitalsInput, webVitalsPayloadSchema)

// ---------------------------------------------------------------------------
// POST — ingest web-vital metrics
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  await connection()

  try {
    const raw = await request.json()
    const parsed = webVitalsInputSchema.safeParse(raw)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid Web Vitals data format' },
        { status: 400 },
      )
    }

    const data = parsed.data
    const performanceScore = calculatePerformanceScore(data.metrics)
    const storageDisabled = isAnalyticsStorageDisabled()

    // Defer DB write — respond immediately, analytics are non-blocking
    if (!storageDisabled) {
      after(async () => {
        const session = await auth().catch(() => null)
        const userAgent = data.userAgent ?? ''
        await insertWebVitalsRecord({
          ...data,
          userId: session?.user?.id ?? data.userId ?? null,
          platform: getUserPlatform(userAgent),
          browser: getUserBrowser(userAgent),
          performanceScore,
        }).catch((err: unknown) =>
          console.error('Web Vitals background write failed:', err),
        )
      })
    }

    return NextResponse.json({
      success: true,
      message: storageDisabled
        ? 'Web Vitals acknowledged (storage disabled)'
        : 'Web Vitals metrics recorded',
      performanceScore,
      storageSkipped: storageDisabled,
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error('Error storing Web Vitals metrics:', error)
    return NextResponse.json({ error: 'Failed to store metrics' }, { status: 500 })
  }
}

// Handles GET requests for retrieving recent Web Vitals analytics (with admin check).
export async function GET(request: NextRequest) {
  await connection() // Ensure DB connection
  try {
    // Ensure the user is authenticated and a platform admin
    const session = await auth()
    if (!session?.user?.id || !isPlatformAdmin(session.user.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Read query params
    const { searchParams } = new URL(request.url)
    const scope = searchParams.get('scope')
    const timeframe = searchParams.get('timeframe') ?? '7d'
    const userId = searchParams.get('userId') ?? session.user.id

    if (scope === 'platform') {
      // For platform-wide admin summary, defer-load only when needed (tree-shaking)
      // TODO: Could fetch aggregations more efficiently if db supports.
      const { getPlatformAnalyticsSummary } = await import(
        '@/features/analytics/lib/analytics-db'
      )
      const summary = await getPlatformAnalyticsSummary({
        timeframe: timeframe === '24h' || timeframe === '30d' ? timeframe : '7d',
      })
      return NextResponse.json({ success: true, data: summary.webVitals })
    }

    // Valid time ranges in ms
    const timeRanges: Record<string, number> = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    }
    // Fallback to 7d if invalid timeframe provided
    const timeRange = timeRanges[timeframe] ?? timeRanges['7d']!
    const startTime = new Date(Date.now() - timeRange)

    // Query "web_vitals" docs for the selected user and timeframe, ordered by recency, limit 100
    const queryResult = await db().queryDocs({
      collection: 'web_vitals',
      filters: [
        { field: 'userId', operator: '==', value: userId },
        { field: 'created_at', operator: '>=', value: startTime },
      ],
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      pagination: { limit: 100 },
    })

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Failed to retrieve analytics data' },
        { status: 500 },
      )
    }

    // Return the web vitals documents with some meta
    return NextResponse.json({
      success: true,
      data: queryResult.data,
      meta: { timeframe, userId, recordCount: queryResult.data.length },
    })
  } catch (error) {
    // Log and return a generic error
    console.error('Error retrieving Web Vitals analytics:', error)
    return NextResponse.json({ error: 'Failed to retrieve analytics' }, { status: 500 })
  }
}
