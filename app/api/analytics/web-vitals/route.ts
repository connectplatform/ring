import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { db } from '@/lib/database'
import {
  insertWebVitalsRecord,
  isAnalyticsStorageDisabled,
  webVitalsPayloadSchema,
  type WebVitalsPayload,
} from '@/features/analytics/lib/analytics-db'

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

function calculatePerformanceScore(
  metrics: Array<{ name: string; rating?: string }>,
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

function normalizeWebVitalsBody(raw: unknown): WebVitalsPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const body = raw as Record<string, unknown>

  if (body.type === 'single-metric' && body.metric && typeof body.metric === 'object') {
    const metric = body.metric as Record<string, unknown>
    return {
      sessionId: String(metric.sessionId ?? `session_${Date.now()}`),
      metrics: [metric as WebVitalsPayload['metrics'][number]],
      url: String(metric.url ?? ''),
      userAgent: String(metric.userAgent ?? ''),
      timestamp: (body.timestamp as number | undefined) ?? Date.now(),
    }
  }

  if (body.type === 'batch-report' && body.report && typeof body.report === 'object') {
    const report = body.report as Record<string, unknown>
    return {
      sessionId: String(report.sessionId ?? `session_${Date.now()}`),
      metrics: (report.metrics as WebVitalsPayload['metrics']) ?? [],
      url: String(report.url ?? ''),
      userAgent: String(report.userAgent ?? ''),
      timestamp: (body.timestamp as number | undefined) ?? Date.now(),
    }
  }

  return body as WebVitalsPayload
}

export async function POST(request: NextRequest) {
  await connection()

  try {
    const session = await auth().catch(() => null)
    const raw = await request.json()
    const normalized = normalizeWebVitalsBody(raw)
    const parsed = webVitalsPayloadSchema.safeParse(normalized)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid Web Vitals data format' },
        { status: 400 },
      )
    }

    const data = parsed.data
    const performanceScore = calculatePerformanceScore(data.metrics)
    const userAgent = data.userAgent ?? ''

    const result = await insertWebVitalsRecord({
      ...data,
      userId: session?.user?.id ?? data.userId ?? null,
      platform: getUserPlatform(userAgent),
      browser: getUserBrowser(userAgent),
      performanceScore,
    })

    return NextResponse.json({
      success: true,
      message: result.skipped
        ? 'Web Vitals acknowledged (storage disabled)'
        : 'Web Vitals metrics recorded',
      performanceScore,
      storageSkipped: result.skipped || isAnalyticsStorageDisabled(),
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error('Error storing Web Vitals metrics:', error)
    return NextResponse.json({ error: 'Failed to store metrics' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id || !isPlatformAdmin(session.user.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const scope = searchParams.get('scope')
    const timeframe = searchParams.get('timeframe') ?? '7d'
    const userId = searchParams.get('userId') ?? session.user.id

    if (scope === 'platform') {
      const { getPlatformAnalyticsSummary } = await import(
        '@/features/analytics/lib/analytics-db'
      )
      const summary = await getPlatformAnalyticsSummary({
        timeframe: timeframe === '24h' || timeframe === '30d' ? timeframe : '7d',
      })
      return NextResponse.json({ success: true, data: summary.webVitals })
    }

    const timeRanges: Record<string, number> = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    }
    const timeRange = timeRanges[timeframe] ?? timeRanges['7d']!
    const startTime = new Date(Date.now() - timeRange)

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

    return NextResponse.json({
      success: true,
      data: queryResult.data,
      meta: { timeframe, userId, recordCount: queryResult.data.length },
    })
  } catch (error) {
    console.error('Error retrieving Web Vitals analytics:', error)
    return NextResponse.json({ error: 'Failed to retrieve analytics' }, { status: 500 })
  }
}
