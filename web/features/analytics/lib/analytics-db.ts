/**
 * Ring Analytics DB layer — server-only.
 * Shared persistence for API ingestion routes and admin aggregates.
 */

import 'server-only'

import { z } from 'zod'
import { db } from '@/lib/database'
import type {
  AnalyticsTimeframe,
  PlatformAnalyticsCoreSummary,
  WebVitalsAggregateMetric,
} from '@/features/analytics/types/platform-analytics'
import {
  dedupeForensicsTraces,
  mapAnalyticsErrorRow,
} from '@/features/analytics/lib/forensics-trace'

const ANALYTICS_EVENTS = 'analytics_events'
const WEB_VITALS = 'web_vitals'
const ANALYTICS_ERRORS = 'analytics_errors'

const SESSION_ID_MAX = 128
const SESSION_ID_REGEX = /^[a-zA-Z0-9_\-:.]+$/

export function isAnalyticsStorageDisabled(): boolean {
  return process.env.ANALYTICS_DISABLE_STORAGE === 'true'
}

const analyticsEventSchema = z.object({
  type: z.string().min(1),
  data: z.unknown().optional(),
  timestamp: z.number().optional(),
})

export const appAnalyticsBatchSchema = z.object({
  sessionId: z
    .string()
    .min(1)
    .max(SESSION_ID_MAX)
    .regex(SESSION_ID_REGEX),
  userId: z.string().nullable().optional(),
  events: z.array(analyticsEventSchema).min(1).max(50),
})

export type AppAnalyticsBatch = z.infer<typeof appAnalyticsBatchSchema>

const webVitalsMetricSchema = z.object({
  name: z.string(),
  value: z.number(),
  delta: z.number().optional(),
  id: z.string().optional(),
  rating: z.enum(['good', 'needs-improvement', 'poor']).optional(),
  navigationType: z.string().optional(),
  timestamp: z.number().optional(),
  sessionId: z.string().optional(),
  url: z.string().optional(),
  userAgent: z.string().optional(),
})

export const webVitalsPayloadSchema = z.object({
  sessionId: z.string().min(1),
  url: z.string().optional(),
  userAgent: z.string().optional(),
  connectionType: z.string().optional(),
  metrics: z.array(webVitalsMetricSchema).min(1),
  timestamp: z.union([z.number(), z.string()]).optional(),
  userId: z.string().nullable().optional(),
})

export type WebVitalsPayload = z.infer<typeof webVitalsPayloadSchema>

const singleErrorSchema = z.object({
  message: z.string().min(1),
  stack: z.string().nullable().optional(),
  component: z.string().optional(),
  url: z.string().optional(),
  userAgent: z.string().optional(),
  severity: z.enum(['error', 'warning', 'info']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.union([z.number(), z.string()]).optional(),
  type: z.string().optional(),
  sessionId: z.string().optional(),
})

export const analyticsErrorPayloadSchema = z.union([
  singleErrorSchema,
  z.object({
    sessionId: z.string().optional(),
    userId: z.string().nullable().optional(),
    errors: z.array(z.record(z.string(), z.unknown())).min(1).max(50),
  }),
])

function timeframeToMs(timeframe: AnalyticsTimeframe): number {
  switch (timeframe) {
    case '24h':
      return 24 * 60 * 60 * 1000
    case '30d':
      return 30 * 24 * 60 * 60 * 1000
    default:
      return 7 * 24 * 60 * 60 * 1000
  }
}

function startDateFor(timeframe: AnalyticsTimeframe): Date {
  return new Date(Date.now() - timeframeToMs(timeframe))
}

function ratingForMetric(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const thresholds: Record<string, { good: number; poor: number }> = {
    LCP: { good: 2500, poor: 4000 },
    FID: { good: 100, poor: 300 },
    INP: { good: 200, poor: 500 },
    CLS: { good: 0.1, poor: 0.25 },
    FCP: { good: 1800, poor: 3000 },
    TTFB: { good: 800, poor: 1800 },
  }
  const t = thresholds[name]
  if (!t) return 'good'
  if (value <= t.good) return 'good'
  if (value <= t.poor) return 'needs-improvement'
  return 'poor'
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!
}

export async function insertAnalyticsEventBatch(
  sessionId: string,
  userId: string | null | undefined,
  events: AppAnalyticsBatch['events'],
): Promise<{ inserted: number; skipped: boolean }> {
  if (isAnalyticsStorageDisabled()) {
    return { inserted: 0, skipped: true }
  }

  let inserted = 0
  for (const event of events) {
    const payload = {
      sessionId,
      userId: userId ?? null,
      eventType: event.type,
      payload: event.data ?? {},
      clientTimestamp: event.timestamp ?? Date.now(),
      recordedAt: new Date().toISOString(),
    }
    const result = await db().createDoc(ANALYTICS_EVENTS, payload)
    if (result.success) inserted++
  }
  return { inserted, skipped: false }
}

export async function insertWebVitalsRecord(
  input: WebVitalsPayload & {
    userId?: string | null
    platform?: string
    browser?: string
    performanceScore?: number
  },
): Promise<{ success: boolean; skipped: boolean }> {
  if (isAnalyticsStorageDisabled()) {
    return { success: true, skipped: true }
  }

  const ts = input.timestamp
  const timestamp =
    typeof ts === 'number' ? new Date(ts) : ts ? new Date(ts) : new Date()

  const result = await db().createDoc(WEB_VITALS, {
    sessionId: input.sessionId,
    userId: input.userId ?? null,
    url: input.url ?? '',
    userAgent: input.userAgent ?? '',
    connectionType: input.connectionType,
    metrics: input.metrics,
    timestamp: timestamp.toISOString(),
    performanceScore: input.performanceScore,
    platform: input.platform,
    browser: input.browser,
  })

  return { success: result.success, skipped: false }
}

function normalizeErrorDoc(
  raw: Record<string, unknown>,
  sessionId?: string | null,
  userId?: string | null,
): Record<string, unknown> {
  const message =
    typeof raw.message === 'string'
      ? raw.message
      : typeof raw.reason === 'string'
        ? raw.reason
        : 'Unknown error'

  return {
    message,
    stack: typeof raw.stack === 'string' ? raw.stack : null,
    referer: typeof raw.referer === 'string' ? raw.referer : null,
    component:
      typeof raw.component === 'string'
        ? raw.component
        : typeof raw.type === 'string'
          ? raw.type
          : 'unknown',
    url: typeof raw.url === 'string' ? raw.url : null,
    userAgent: typeof raw.userAgent === 'string' ? raw.userAgent : null,
    userId: userId ?? (typeof raw.userId === 'string' ? raw.userId : null),
    sessionId:
      sessionId ?? (typeof raw.sessionId === 'string' ? raw.sessionId : null),
    severity:
      raw.severity === 'warning' || raw.severity === 'info'
        ? raw.severity
        : 'error',
    metadata: raw.metadata ?? raw.context ?? {},
    timestamp:
      typeof raw.timestamp === 'number'
        ? new Date(raw.timestamp).toISOString()
        : typeof raw.timestamp === 'string'
          ? raw.timestamp
          : new Date().toISOString(),
    environment: process.env.NODE_ENV ?? 'development',
  }
}

export async function insertAnalyticsErrors(
  body: unknown,
): Promise<{ inserted: number; skipped: boolean }> {
  if (isAnalyticsStorageDisabled()) {
    return { inserted: 0, skipped: true }
  }

  const parsed = analyticsErrorPayloadSchema.safeParse(body)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid error payload')
  }

  const payload = parsed.data
  const docs: Record<string, unknown>[] = []

  if ('errors' in payload && Array.isArray(payload.errors)) {
    for (const err of payload.errors) {
      docs.push(
        normalizeErrorDoc(err, payload.sessionId, payload.userId ?? null),
      )
    }
  } else {
    docs.push(normalizeErrorDoc(payload as Record<string, unknown>))
  }

  let inserted = 0
  for (const doc of docs) {
    const result = await db().createDoc(ANALYTICS_ERRORS, doc)
    if (result.success) inserted++
  }
  return { inserted, skipped: false }
}

export async function getPlatformAnalyticsSummary(options: {
  timeframe?: AnalyticsTimeframe
}): Promise<PlatformAnalyticsCoreSummary> {
  const timeframe = options.timeframe ?? '7d'
  const periodStart = startDateFor(timeframe)
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [
    usersTotal,
    usersNew,
    entitiesTotal,
    opportunitiesTotal,
    eventsPeriod,
    events24h,
    vitalsPeriod,
    errorsPeriod,
    errors24h,
    recentErrors,
  ] = await Promise.all([
    db().countDocs('users'),
    db().countDocs('users', [
      { field: 'created_at', operator: '>=', value: periodStart },
    ]),
    db().countDocs('entities'),
    db().countDocs('opportunities'),
    db().queryDocs({
      collection: ANALYTICS_EVENTS,
      filters: [{ field: 'created_at', operator: '>=', value: periodStart }],
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      pagination: { limit: 5000 },
    }),
    db().queryDocs({
      collection: ANALYTICS_EVENTS,
      filters: [{ field: 'created_at', operator: '>=', value: dayAgo }],
      pagination: { limit: 5000 },
    }),
    db().queryDocs({
      collection: WEB_VITALS,
      filters: [{ field: 'created_at', operator: '>=', value: periodStart }],
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      pagination: { limit: 500 },
    }),
    db().countDocs(ANALYTICS_ERRORS, [
      { field: 'created_at', operator: '>=', value: periodStart },
    ]),
    db().countDocs(ANALYTICS_ERRORS, [
      { field: 'created_at', operator: '>=', value: dayAgo },
    ]),
    db().queryDocs({
      collection: ANALYTICS_ERRORS,
      filters: [{ field: 'created_at', operator: '>=', value: periodStart }],
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      pagination: { limit: 20 },
    }),
  ])

  if (!usersTotal.success) throw usersTotal.error ?? new Error('Failed to count users')

  const periodEvents = eventsPeriod.success ? eventsPeriod.data : []
  const last24hEvents = events24h.success ? events24h.data : []

  const sessions24h = new Set(
    last24hEvents
      .map((row) => row.sessionId as string | undefined)
      .filter(Boolean),
  )

  const pageViews = periodEvents.filter((row) => {
    const type = row.eventType as string | undefined
    if (
      type === 'app_load' ||
      type === 'page_view' ||
      type === 'docs_page_view' ||
      type === 'personal_page_view'
    ) {
      return true
    }
    const payload = row.payload as Record<string, unknown> | undefined
    return payload?.type === 'app_load' || payload?.eventType === 'page_view'
  }).length

  const vitalsRows = vitalsPeriod.success ? vitalsPeriod.data : []
  const metricBuckets = new Map<string, number[]>()

  for (const row of vitalsRows) {
    const metrics = row.metrics as Array<{ name: string; value: number }> | undefined
    if (!Array.isArray(metrics)) continue
    for (const m of metrics) {
      if (!m?.name || typeof m.value !== 'number') continue
      const bucket = metricBuckets.get(m.name) ?? []
      bucket.push(m.value)
      metricBuckets.set(m.name, bucket)
    }
  }

  const webVitalsMetrics: WebVitalsAggregateMetric[] = []
  for (const [name, values] of metricBuckets.entries()) {
    const value = median(values)
    webVitalsMetrics.push({
      name,
      value,
      rating: ratingForMetric(name, value),
      sampleCount: values.length,
    })
  }

  const errorRows = recentErrors.success ? recentErrors.data : []

  return {
    timeframe,
    platform: {
      totalUsers: usersTotal.data ?? 0,
      newUsers: usersNew.success ? (usersNew.data ?? 0) : 0,
      totalEntities: entitiesTotal.success ? (entitiesTotal.data ?? 0) : 0,
      totalOpportunities: opportunitiesTotal.success
        ? (opportunitiesTotal.data ?? 0)
        : 0,
    },
    engagement: {
      activeSessions24h: sessions24h.size,
      pageViews,
      hasEventData: periodEvents.length > 0,
    },
    webVitals: {
      metrics: webVitalsMetrics,
      hasData: vitalsRows.length > 0,
    },
    errors: {
      count24h: errors24h.success ? (errors24h.data ?? 0) : 0,
      countPeriod: errorsPeriod.success ? (errorsPeriod.data ?? 0) : 0,
      recent: dedupeForensicsTraces(
        errorRows.map((row) => mapAnalyticsErrorRow(row as Record<string, unknown>)),
      ),
      hasData: (errorsPeriod.success ? (errorsPeriod.data ?? 0) : 0) > 0,
    },
  }
}
