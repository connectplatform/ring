export type MatcherTimeframe = '24h' | '7d' | '30d' | '90d'

export const MATCHER_TIMEFRAMES: MatcherTimeframe[] = ['24h', '7d', '30d', '90d']

export function parseMatcherTimeframe(value: string | undefined): MatcherTimeframe {
  if (value && MATCHER_TIMEFRAMES.includes(value as MatcherTimeframe)) {
    return value as MatcherTimeframe
  }
  return '7d'
}

export interface MatcherAnalyticsSummary {
  timeframe: MatcherTimeframe
  hasData: boolean
  overview: {
    totalMatchNotifications: number
    totalMatchRuns: number
    averageMatchScore: number
    matchRunsWithMatches: number
    opportunitiesProcessed: number
    averageProcessingTimeMs: number
    autoApprovals: number
  }
  quality: {
    distribution: { excellent: number; good: number; fair: number; poor: number }
    topFactors: string[]
  }
  performance: {
    autoFillAvgConfidence: number | null
    autoFillRuns: number
    llmAvailableRate: number
  }
  engagement: {
    notificationsSent: number
    notificationReadRate: number
    hasEngagementData: boolean
  }
  trends: {
    daily: Array<{ date: string; notifications: number; avgScore: number; runs: number }>
  }
  moderation: { openReports: number }
  config: {
    scoreThreshold: number
    maxMatches: number
    autoApprove: boolean
    autoApproveMinScore: number
    llmConfidenceGate: number
    source: 'db' | 'env' | 'default'
  }
  llmUsage: { hasData: false }
}
