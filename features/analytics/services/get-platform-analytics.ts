import 'server-only'

import type { AnalyticsTimeframe, PlatformAnalyticsSummary } from '@/features/analytics/types/platform-analytics'
import { getPlatformAnalyticsSummary } from '@/features/analytics/lib/analytics-db'
import { getDocsNotFoundAnalyticsSummary } from '@/features/analytics/lib/docs-analytics'

const EMPTY_DOCS_ANALYTICS: PlatformAnalyticsSummary['docs'] = {
  notFoundCount24h: 0,
  notFoundCountPeriod: 0,
  recentNotFound: [],
  hasData: false,
}

export async function getPlatformAnalytics(
  timeframe: AnalyticsTimeframe = '7d',
): Promise<PlatformAnalyticsSummary> {
  const [summary, docsNotFound] = await Promise.all([
    getPlatformAnalyticsSummary({ timeframe }),
    getDocsNotFoundAnalyticsSummary(timeframe).catch(() => null),
  ])

  return {
    ...summary,
    docs: docsNotFound
      ? {
          notFoundCount24h: docsNotFound.count24h,
          notFoundCountPeriod: docsNotFound.countPeriod,
          recentNotFound: docsNotFound.recent,
          hasData: docsNotFound.hasData,
        }
      : EMPTY_DOCS_ANALYTICS,
  }
}
