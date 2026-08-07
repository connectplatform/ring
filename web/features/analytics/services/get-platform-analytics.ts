import 'server-only'

import type { AnalyticsTimeframe, PlatformAnalyticsSummary } from '@/features/analytics/types/platform-analytics'
import { getPlatformAnalyticsSummary } from '@/features/analytics/lib/analytics-db'
import { getDocsNotFoundAnalyticsSummary } from '@/features/analytics/lib/docs-analytics'
import { getPersonalPagePlatformStats } from '@/features/analytics/lib/personal-page-analytics'

const EMPTY_DOCS_ANALYTICS: PlatformAnalyticsSummary['docs'] = {
  notFoundCount24h: 0,
  notFoundCountPeriod: 0,
  recentNotFound: [],
  hasData: false,
}

const EMPTY_PERSONAL_PAGES: PlatformAnalyticsSummary['personalPages'] = {
  unique24h: 0,
  uniquePeriod: 0,
  visits24h: 0,
  visitsPeriod: 0,
  privateUnique24h: 0,
  privateUniquePeriod: 0,
  byRole24h: [],
  byRolePeriod: [],
  topProfiles: [],
  hasData: false,
}

export async function getPlatformAnalytics(
  timeframe: AnalyticsTimeframe = '7d',
): Promise<PlatformAnalyticsSummary> {
  const [summary, docsNotFound, personalPages] = await Promise.all([
    getPlatformAnalyticsSummary({ timeframe }),
    getDocsNotFoundAnalyticsSummary(timeframe).catch(() => null),
    getPersonalPagePlatformStats(timeframe).catch(() => null),
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
    personalPages: personalPages
      ? {
          unique24h: personalPages.unique24h,
          uniquePeriod: personalPages.unique7d,
          visits24h: personalPages.visits24h,
          visitsPeriod: personalPages.visits7d,
          privateUnique24h: personalPages.privateUnique24h,
          privateUniquePeriod: personalPages.privateUnique7d,
          byRole24h: personalPages.byRole24h,
          byRolePeriod: personalPages.byRole7d,
          topProfiles: personalPages.topProfiles,
          hasData: personalPages.hasData,
        }
      : EMPTY_PERSONAL_PAGES,
  }
}
