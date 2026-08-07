import 'server-only'

import { auth } from '@/auth'
import { db } from '@/lib/database'
import {
  insertAnalyticsEventBatch,
  isAnalyticsStorageDisabled,
} from '@/features/analytics/lib/analytics-db'
import { dedupeForensicsTraces, mapDocs404EventRow } from '@/features/analytics/lib/forensics-trace'
import { getRequestForensicsContext } from '@/features/analytics/lib/request-forensics'
import type { AnalyticsForensicsTrace } from '@/features/analytics/types/forensics-trace'
import {
  buildDocsPublicPath,
  listDocsInSection,
  listDocsRootSuggestions,
  type DocsLinkSuggestion,
} from '@/lib/docs/docs-sections'
import { getDocTitleFromFile } from '@/lib/docs/docs-article'
import { resolveDocFilePath } from '@/lib/docs/docs-path'

const ANALYTICS_EVENTS = 'analytics_events'

export const DOCS_EVENT_TYPES = {
  pageView: 'docs_page_view',
  notFound: 'docs_404',
  security: 'security_event',
} as const

async function recordServerDocsEvent(
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (isAnalyticsStorageDisabled()) return

  const session = await auth().catch(() => null)
  const forensics = await getRequestForensicsContext()
  const sessionId = `server-docs:${forensics.ip ?? 'unknown'}`

  await insertAnalyticsEventBatch(sessionId, session?.user?.id ?? null, [
    {
      type: eventType,
      data: {
        ...payload,
        ip: forensics.ip,
        userAgent: forensics.userAgent,
        referer: forensics.referer,
        originatingPath: forensics.referer,
        requestUrl: forensics.requestUrl,
        requestPath: forensics.requestPath,
        source: 'server',
      },
      timestamp: Date.now(),
    },
  ])
}

export async function recordDocsPageView(input: {
  locale: string
  slug: string[]
  path: string
}): Promise<void> {
  const category = input.slug[0] ?? null
  await recordServerDocsEvent(DOCS_EVENT_TYPES.pageView, {
    locale: input.locale,
    slug: input.slug,
    path: input.path,
    category,
  })
}

export async function recordDocs404(input: {
  locale: string
  slug: string[]
  path: string
  reason: 'missing_file' | 'invalid_path'
  categoryValid: boolean
}): Promise<void> {
  await recordServerDocsEvent(DOCS_EVENT_TYPES.notFound, {
    locale: input.locale,
    slug: input.slug,
    path: input.path,
    reason: input.reason,
    category: input.slug[0] ?? null,
    categoryValid: input.categoryValid,
  })
}

export async function recordDocsUnknownCategorySecurityEvent(input: {
  locale: string
  slug: string[]
  path: string
  category: string
}): Promise<void> {
  await recordServerDocsEvent(DOCS_EVENT_TYPES.security, {
    subtype: 'docs_unknown_category',
    severity: 'medium',
    status: 'open',
    type: 'security_violation',
    details: `Unknown docs section requested: "${input.category}"`,
    locale: input.locale,
    slug: input.slug,
    path: input.path,
    category: input.category,
  })
}

export async function getPopularDocsInCategory(
  locale: string,
  category: string | null,
  limit = 6,
): Promise<DocsLinkSuggestion[]> {
  if (category) {
    const fromAnalytics = await queryPopularDocsFromAnalytics(locale, category, limit)
    if (fromAnalytics.length > 0) return fromAnalytics
    return listDocsInSection(locale, category, limit)
  }
  return listDocsRootSuggestions(locale, limit)
}

async function queryPopularDocsFromAnalytics(
  locale: string,
  category: string,
  limit: number,
): Promise<DocsLinkSuggestion[]> {
  if (isAnalyticsStorageDisabled()) return []

  const periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const result = await db().queryDocs({
    collection: ANALYTICS_EVENTS,
    filters: [
      { field: 'eventType', operator: '==', value: DOCS_EVENT_TYPES.pageView },
      { field: 'created_at', operator: '>=', value: periodStart },
    ],
    orderBy: [{ field: 'created_at', direction: 'desc' }],
    pagination: { limit: 2000 },
  })

  if (!result.success || !result.data?.length) return []

  const counts = new Map<string, { count: number; payload: Record<string, unknown> }>()

  for (const row of result.data) {
    const payload = (row.payload ?? {}) as Record<string, unknown>
    if (payload.locale !== locale) continue
    if (payload.category !== category) continue

    const slug = Array.isArray(payload.slug)
      ? (payload.slug as string[])
      : typeof payload.path === 'string'
        ? payload.path.replace(/^\/(en|uk|ru)\/docs\/?/, '').split('/').filter(Boolean)
        : []

    const key = slug.join('/')
    if (!key) continue

    const existing = counts.get(key)
    if (existing) {
      existing.count += 1
    } else {
      counts.set(key, { count: 1, payload: { ...payload, slug } })
    }
  }

  const ranked = [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)

  const suggestions: DocsLinkSuggestion[] = []
  for (const [, entry] of ranked) {
    const slug = entry.payload.slug as string[]
    const { filePath } = resolveDocFilePath(locale, slug)
    if (!filePath) continue
    suggestions.push({
      title: getDocTitleFromFile(filePath, slug[slug.length - 1] ?? 'Docs'),
      href: buildDocsPublicPath(locale, slug),
      slug,
    })
  }

  if (suggestions.length < limit) {
    const fallback = listDocsInSection(locale, category, limit)
    for (const item of fallback) {
      if (suggestions.some((s) => s.href === item.href)) continue
      suggestions.push(item)
      if (suggestions.length >= limit) break
    }
  }

  return suggestions.slice(0, limit)
}

export interface DocsNotFoundAnalyticsSummary {
  count24h: number
  countPeriod: number
  recent: AnalyticsForensicsTrace[]
  hasData: boolean
}

export async function getDocsNotFoundAnalyticsSummary(
  timeframe: '24h' | '7d' | '30d' = '7d',
): Promise<DocsNotFoundAnalyticsSummary> {
  const ms =
    timeframe === '24h'
      ? 24 * 60 * 60 * 1000
      : timeframe === '30d'
        ? 30 * 24 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000

  const periodStart = new Date(Date.now() - ms)
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [periodResult, dayResult] = await Promise.all([
    db().queryDocs({
      collection: ANALYTICS_EVENTS,
      filters: [
        { field: 'eventType', operator: '==', value: DOCS_EVENT_TYPES.notFound },
        { field: 'created_at', operator: '>=', value: periodStart },
      ],
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      pagination: { limit: 50 },
    }),
    db().queryDocs({
      collection: ANALYTICS_EVENTS,
      filters: [
        { field: 'eventType', operator: '==', value: DOCS_EVENT_TYPES.notFound },
        { field: 'created_at', operator: '>=', value: dayAgo },
      ],
      pagination: { limit: 500 },
    }),
  ])

  const periodRows = periodResult.success ? periodResult.data : []
  const dayRows = dayResult.success ? dayResult.data : []

  return {
    count24h: dayRows.length,
    countPeriod: periodRows.length,
    recent: dedupeForensicsTraces(
      periodRows.slice(0, 50).map((row) => mapDocs404EventRow(row)),
    ).slice(0, 12),
    hasData: periodRows.length > 0,
  }
}

export async function getRecentDocsSecurityEvents(limit = 10) {
  const periodStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const result = await db().queryDocs({
    collection: ANALYTICS_EVENTS,
    filters: [
      { field: 'eventType', operator: '==', value: DOCS_EVENT_TYPES.security },
      { field: 'created_at', operator: '>=', value: periodStart },
    ],
    orderBy: [{ field: 'created_at', direction: 'desc' }],
    pagination: { limit },
  })

  if (!result.success) return []
  return result.data.map((row) => {
    const payload = (row.payload ?? {}) as Record<string, unknown>
    return {
      id: row.id,
      type: String(payload.type ?? 'security_violation'),
      severity: String(payload.severity ?? 'medium'),
      details: String(payload.details ?? 'Security event'),
      timestamp:
        (row.recordedAt as string | undefined) ??
        (row.created_at as string | undefined) ??
        new Date().toISOString(),
      status: String(payload.status ?? 'open'),
      path: typeof payload.path === 'string' ? payload.path : undefined,
    }
  })
}
