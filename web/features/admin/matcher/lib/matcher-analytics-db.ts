import 'server-only'

import { db } from '@/lib/database'
import { getResolvedAIConfig } from '@/features/admin/platform-settings/resolved-ai-config'
import { getMatcherInstallDefaults } from '@/lib/ring-config-core'
import type {
  MatcherAnalyticsSummary,
  MatcherTimeframe,
} from '@/features/admin/matcher/types/matcher-analytics'

const EVENTS = 'events'
const NOTIFICATIONS = 'notifications'
const MATCH_NOTIFICATION_TYPE = 'opportunity_matched_ai'
const MATCH_RUN_TYPES = new Set(['opportunity_matched_ai', 'opportunity_matched'])
const LLM_CONFIDENCE_GATE = 0.8
const QUERY_LIMIT = 5000

function timeframeToMs(timeframe: MatcherTimeframe): number {
  switch (timeframe) {
    case '24h':
      return 24 * 60 * 60 * 1000
    case '30d':
      return 30 * 24 * 60 * 60 * 1000
    case '90d':
      return 90 * 24 * 60 * 60 * 1000
    default:
      return 7 * 24 * 60 * 60 * 1000
  }
}

function startDateFor(timeframe: MatcherTimeframe): Date {
  return new Date(Date.now() - timeframeToMs(timeframe))
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function bucketScore(score: number): keyof MatcherAnalyticsSummary['quality']['distribution'] {
  if (score >= 80) return 'excellent'
  if (score >= 70) return 'good'
  if (score >= 60) return 'fair'
  return 'poor'
}

function extractMatchScore(row: Record<string, unknown>): number | null {
  const nested = row.data as { matchScore?: number } | undefined
  const score = Number(nested?.matchScore ?? row.matchScore)
  return Number.isFinite(score) ? score : null
}

type EventRow = Record<string, unknown> & {
  type?: string
  payload?: {
    matchingResult?: {
      matches?: Array<{ confidence?: number; overallScore?: number; factors?: Record<string, number> }>
      matchQuality?: {
        averageScore?: number
        highQualityMatches?: number
      }
      processingTime?: number
    }
    autoFillResult?: { confidence?: number }
  }
}

function aggregateEvents(rows: EventRow[]) {
  const distribution = { excellent: 0, good: 0, fair: 0, poor: 0 }
  const factorTotals = new Map<string, { sum: number; count: number }>()
  let processingTimeSum = 0
  let processingTimeCount = 0
  let autoFillSum = 0
  let autoFillCount = 0
  let llmRuns = 0
  let matchRuns = 0
  let matchRunsWithMatches = 0
  let scoreSum = 0
  let scoreCount = 0
  let autoApprovals = 0

  for (const row of rows) {
    if (row.type === 'opportunity_auto_approved') {
      autoApprovals++
      continue
    }
    if (!row.type || !MATCH_RUN_TYPES.has(row.type)) continue

    matchRuns++
    const matchingResult = row.payload?.matchingResult
    const autoFillResult = row.payload?.autoFillResult

    if (typeof autoFillResult?.confidence === 'number') {
      autoFillSum += autoFillResult.confidence
      autoFillCount++
    }

    if (typeof matchingResult?.processingTime === 'number') {
      processingTimeSum += matchingResult.processingTime
      processingTimeCount++
    }

    const matches = matchingResult?.matches ?? []
    if (matches.length > 0) {
      matchRunsWithMatches++
    }

    const bestConfidence = matches.reduce(
      (max, m) => Math.max(max, m.confidence ?? 0),
      0,
    )
    if (bestConfidence >= LLM_CONFIDENCE_GATE) {
      llmRuns++
    }

    const avgFromQuality = matchingResult?.matchQuality?.averageScore
    if (typeof avgFromQuality === 'number' && Number.isFinite(avgFromQuality)) {
      scoreSum += avgFromQuality
      scoreCount++
      distribution[bucketScore(avgFromQuality)]++
    } else {
      for (const match of matches) {
        if (typeof match.overallScore === 'number') {
          scoreSum += match.overallScore
          scoreCount++
          distribution[bucketScore(match.overallScore)]++
        }
        if (match.factors) {
          for (const [factor, value] of Object.entries(match.factors)) {
            if (typeof value !== 'number') continue
            const entry = factorTotals.get(factor) ?? { sum: 0, count: 0 }
            entry.sum += value
            entry.count++
            factorTotals.set(factor, entry)
          }
        }
      }
    }
  }

  const topFactors = [...factorTotals.entries()]
    .map(([factor, { sum, count }]) => ({ factor, avg: sum / count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 3)
    .map((entry) => entry.factor)

  return {
    matchRuns,
    matchRunsWithMatches,
    autoApprovals,
    averageMatchScore: scoreCount ? Math.round((scoreSum / scoreCount) * 10) / 10 : 0,
    distribution,
    topFactors,
    averageProcessingTimeMs:
      processingTimeCount > 0 ? Math.round(processingTimeSum / processingTimeCount) : 0,
    autoFillAvgConfidence:
      autoFillCount > 0 ? Math.round((autoFillSum / autoFillCount) * 1000) / 10 : null,
    autoFillRuns: autoFillCount,
    llmAvailableRate: matchRuns > 0 ? Math.round((llmRuns / matchRuns) * 100) / 100 : 0,
  }
}

async function countMatchNotificationsSince(since: Date): Promise<number> {
  const result = await db().countDocs(NOTIFICATIONS, [
    { field: 'type', operator: '=', value: MATCH_NOTIFICATION_TYPE },
    { field: 'created_at', operator: '>=', value: since },
  ])
  return result.success ? (result.data ?? 0) : 0
}

async function queryMatchNotificationsSince(since: Date) {
  return db().queryDocs<Record<string, unknown>>({
    collection: NOTIFICATIONS,
    filters: [
      { field: 'type', operator: '=', value: MATCH_NOTIFICATION_TYPE },
      { field: 'created_at', operator: '>=', value: since },
    ],
    orderBy: [{ field: 'created_at', direction: 'desc' }],
    pagination: { limit: QUERY_LIMIT },
  })
}

async function buildDailyTrends(
  timeframe: MatcherTimeframe,
  periodStart: Date,
): Promise<MatcherAnalyticsSummary['trends']['daily']> {
  const dayMs = 24 * 60 * 60 * 1000
  const days =
    timeframe === '24h'
      ? 1
      : timeframe === '7d'
        ? 7
        : timeframe === '30d'
          ? 30
          : 90

  const eventResult = await db().queryDocs<EventRow>({
    collection: EVENTS,
    filters: [{ field: 'created_at', operator: '>=', value: periodStart }],
    orderBy: [{ field: 'created_at', direction: 'desc' }],
    pagination: { limit: QUERY_LIMIT },
  })
  const eventRows = eventResult.success ? eventResult.data : []

  const daily: MatcherAnalyticsSummary['trends']['daily'] = []

  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(Date.now() - (i + 1) * dayMs)
    const dayEnd = new Date(Date.now() - i * dayMs)
    const date = toDateKey(dayEnd)

    const notifications = await db().countDocs(NOTIFICATIONS, [
      { field: 'type', operator: '=', value: MATCH_NOTIFICATION_TYPE },
      { field: 'created_at', operator: '>=', value: dayStart },
      { field: 'created_at', operator: '<', value: dayEnd },
    ])

    const runsForDay = eventRows.filter((row) => {
      if (!row.type || !MATCH_RUN_TYPES.has(row.type)) return false
      const timeMs = Number(row.timeMs)
      if (Number.isFinite(timeMs)) {
        return timeMs >= dayStart.getTime() && timeMs < dayEnd.getTime()
      }
      return false
    })

    let scoreSum = 0
    let scoreCount = 0
    for (const row of runsForDay) {
      const avg = row.payload?.matchingResult?.matchQuality?.averageScore
      if (typeof avg === 'number') {
        scoreSum += avg
        scoreCount++
      }
    }

    daily.push({
      date,
      notifications: notifications.success ? (notifications.data ?? 0) : 0,
      runs: runsForDay.length,
      avgScore: scoreCount ? Math.round((scoreSum / scoreCount) * 10) / 10 : 0,
    })
  }

  return daily
}

export async function getMatcherAnalyticsSummary(
  timeframe: MatcherTimeframe = '7d',
): Promise<MatcherAnalyticsSummary> {
  const periodStart = startDateFor(timeframe)

  const [
    eventQuery,
    notificationQuery,
    totalNotifications,
    openReportsResult,
    aiConfig,
    installDefaults,
  ] = await Promise.all([
    db().queryDocs<EventRow>({
      collection: EVENTS,
      filters: [{ field: 'created_at', operator: '>=', value: periodStart }],
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      pagination: { limit: QUERY_LIMIT },
    }),
    queryMatchNotificationsSince(periodStart),
    countMatchNotificationsSince(periodStart),
    db().countDocs('entity_reports', [
      { field: 'status', operator: '=', value: 'open' },
    ]),
    getResolvedAIConfig(),
    Promise.resolve(getMatcherInstallDefaults()),
  ])

  const eventRows = eventQuery.success ? eventQuery.data : []
  const notificationRows = notificationQuery.success ? notificationQuery.data : []

  const eventAgg = aggregateEvents(eventRows)

  const notificationScores = notificationRows
    .map((row) => extractMatchScore(row))
    .filter((s): s is number => s !== null)
  const readCount = notificationRows.filter((row) => Boolean(row.read_at)).length

  const averageFromNotifications =
    notificationScores.length > 0
      ? Math.round(
          (notificationScores.reduce((a, b) => a + b, 0) / notificationScores.length) * 10,
        ) / 10
      : 0

  const averageMatchScore =
    eventAgg.averageMatchScore > 0 ? eventAgg.averageMatchScore : averageFromNotifications

  const daily = await buildDailyTrends(timeframe, periodStart)

  const hasData =
    totalNotifications > 0 ||
    eventAgg.matchRuns > 0 ||
    eventAgg.autoApprovals > 0

  return {
    timeframe,
    hasData,
    overview: {
      totalMatchNotifications: totalNotifications,
      totalMatchRuns: eventAgg.matchRuns,
      averageMatchScore,
      matchRunsWithMatches: eventAgg.matchRunsWithMatches,
      opportunitiesProcessed: eventAgg.matchRuns,
      averageProcessingTimeMs: eventAgg.averageProcessingTimeMs,
      autoApprovals: eventAgg.autoApprovals,
    },
    quality: {
      distribution: eventAgg.distribution,
      topFactors: eventAgg.topFactors,
    },
    performance: {
      autoFillAvgConfidence: eventAgg.autoFillAvgConfidence,
      autoFillRuns: eventAgg.autoFillRuns,
      llmAvailableRate: eventAgg.llmAvailableRate,
    },
    engagement: {
      notificationsSent: totalNotifications,
      notificationReadRate:
        notificationRows.length > 0
          ? Math.round((readCount / notificationRows.length) * 100) / 100
          : 0,
      hasEngagementData: notificationRows.length > 0,
    },
    trends: { daily },
    moderation: {
      openReports: openReportsResult.success ? (openReportsResult.data ?? 0) : 0,
    },
    config: {
      scoreThreshold: aiConfig.matcher.scoreThreshold,
      maxMatches: aiConfig.matcher.maxMatches,
      autoApprove: aiConfig.matcher.autoApprove,
      autoApproveMinScore: aiConfig.matcher.autoApproveMinScore,
      llmConfidenceGate: installDefaults.llmConfidenceGate,
      source: aiConfig.source,
    },
    llmUsage: { hasData: false },
  }
}
