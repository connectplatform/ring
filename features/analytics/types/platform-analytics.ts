import type { AnalyticsForensicsTrace } from '@/features/analytics/types/forensics-trace'

export type AnalyticsTimeframe = '24h' | '7d' | '30d'

export interface WebVitalsAggregateMetric {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  sampleCount: number
}

export interface AnalyticsErrorSummary extends AnalyticsForensicsTrace {
  kind: 'client_error'
}

/** @deprecated Use AnalyticsForensicsTrace with kind docs_404 */
export interface DocsNotFoundSummary extends AnalyticsForensicsTrace {
  kind: 'docs_404'
}

export interface PlatformAnalyticsSummary {
  timeframe: AnalyticsTimeframe
  platform: {
    totalUsers: number
    newUsers: number
    totalEntities: number
    totalOpportunities: number
  }
  engagement: {
    activeSessions24h: number
    pageViews: number
    hasEventData: boolean
  }
  webVitals: {
    metrics: WebVitalsAggregateMetric[]
    hasData: boolean
  }
  errors: {
    count24h: number
    countPeriod: number
    recent: AnalyticsForensicsTrace[]
    hasData: boolean
  }
  docs: {
    notFoundCount24h: number
    notFoundCountPeriod: number
    recentNotFound: AnalyticsForensicsTrace[]
    hasData: boolean
  }
  personalPages: {
    unique24h: number
    uniquePeriod: number
    visits24h: number
    visitsPeriod: number
    privateUnique24h: number
    privateUniquePeriod: number
    byRole24h: Array<{ role: string; unique: number; visits: number }>
    byRolePeriod: Array<{ role: string; unique: number; visits: number }>
    topProfiles: Array<{
      username: string
      unique: number
      visits: number
      privateUnique: number
    }>
    hasData: boolean
  }
}

/** Platform aggregates without docs/personal-page composition queries. */
export type PlatformAnalyticsCoreSummary = Omit<
  PlatformAnalyticsSummary,
  'docs' | 'personalPages'
>
