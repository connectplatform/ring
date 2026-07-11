import 'server-only'

import { getMatcherAnalyticsSummary } from '@/features/admin/matcher/lib/matcher-analytics-db'
import {
  parseMatcherTimeframe,
  type MatcherTimeframe,
} from '@/features/admin/matcher/types/matcher-analytics'

export async function getMatcherAnalytics(timeframe: MatcherTimeframe | string = '7d') {
  const parsed = typeof timeframe === 'string' ? parseMatcherTimeframe(timeframe) : timeframe
  return getMatcherAnalyticsSummary(parsed)
}

export type { MatcherAnalyticsSummary, MatcherTimeframe } from '@/features/admin/matcher/types/matcher-analytics'
