import 'server-only'

import { db } from '@/lib/database'
import type { WebVitalsAggregateMetric } from '@/features/analytics/types/platform-analytics'

/**
 * Web Vitals rating thresholds (aligned with analytics-db.ts ratingForMetric).
 */
const THRESHOLDS: Record<string, { good: number; poor: number }> = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  INP: { good: 200, poor: 500 },
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
}

function ratingForMetric(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const t = THRESHOLDS[name]
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

export interface NewsWebVitalsSummary {
  metrics: WebVitalsAggregateMetric[]
  hasData: boolean
  totalSamples: number
}

/**
 * Fetch web-vitals metrics for news pages only.
 *
 * Queries the `web_vitals` collection filtered by URL patterns containing `/news/`.
 * Returns aggregated median values per metric (CLS, LCP, INP, FCP, TTFB) with
 * Google-aligned ratings (good / needs-improvement / poor).
 *
 * @param timeframe - How far back to look (default: 30 days)
 */
export async function getNewsWebVitals(
  timeframe: '7d' | '30d' | '90d' = '30d',
): Promise<NewsWebVitalsSummary> {
  const daysMap = { '7d': 7, '30d': 30, '90d': 90 } as const
  const cutoff = new Date(Date.now() - daysMap[timeframe] * 24 * 60 * 60 * 1000)

  try {
    // Query web_vitals for news-related URLs
    // The web_vitals collection stores each record with a `url` field and `metrics` array
    const result = await db().queryDocs({
      collection: 'web_vitals',
      filters: [
        { field: 'created_at', operator: '>=', value: cutoff },
      ],
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      pagination: { limit: 1000 },
    })

    if (!result.success || !result.data) {
      return { metrics: [], hasData: false, totalSamples: 0 }
    }

    // Filter to news URLs and aggregate metrics
    const metricBuckets = new Map<string, number[]>()
    let newsRowCount = 0

    for (const row of result.data) {
      const d = row.data ?? (row as Record<string, unknown>)
      const url = (d as Record<string, unknown>).url as string | undefined

      // Only include rows where URL contains /news/
      if (!url || !url.includes('/news/')) continue
      newsRowCount++

      const metrics = (d as Record<string, unknown>).metrics as
        | Array<{ name: string; value: number }>
        | undefined
      if (!Array.isArray(metrics)) continue

      for (const m of metrics) {
        if (!m?.name || typeof m.value !== 'number') continue
        const bucket = metricBuckets.get(m.name) ?? []
        bucket.push(m.value)
        metricBuckets.set(m.name, bucket)
      }
    }

    // Build aggregate metrics
    const aggregated: WebVitalsAggregateMetric[] = []
    let totalSamples = 0

    for (const [name, values] of metricBuckets.entries()) {
      const value = median(values)
      aggregated.push({
        name,
        value,
        rating: ratingForMetric(name, value),
        sampleCount: values.length,
      })
      totalSamples += values.length
    }

    return {
      metrics: aggregated,
      hasData: newsRowCount > 0,
      totalSamples,
    }
  } catch (error) {
    console.error('Error fetching news web-vitals:', error)
    return { metrics: [], hasData: false, totalSamples: 0 }
  }
}
