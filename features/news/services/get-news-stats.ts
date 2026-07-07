import 'server-only'

import { db } from '@/lib/database'
import { unstable_cache } from 'next/cache'
import type { NewsStatsSummary } from '@/features/news/types'

/**
 * Fetch lightweight news statistics for the admin sidebar.
 * Uses React 19 `unstable_cache` to deduplicate across parallel page renders
 * and revalidate on demand after mutations.
 *
 * @remarks
 * This is intentionally a lightweight aggregate (4 countDocs calls + 1 paginated
 * query for views) — avoids the full analytics pipeline.  If richer metrics are
 * needed, prefer getNewsAnalytics() from the analytics page instead.
 *
 * Statistics returned:
 * - totalArticles, publishedArticles, draftArticles, archivedArticles
 * - totalViews, totalLikes, totalComments (aggregated from a recent sample)
 */
export const getNewsStats = unstable_cache(
  async (): Promise<NewsStatsSummary> => {
    const [total, published, drafts, archived] = await Promise.all([
      db().countDocs('news'),
      db().countDocs('news', [{ field: 'status', operator: '==', value: 'published' }]),
      db().countDocs('news', [{ field: 'status', operator: '==', value: 'draft' }]),
      db().countDocs('news', [{ field: 'status', operator: '==', value: 'archived' }]),
    ])

    // Aggregate engagement metrics from recent articles (limit 500 for performance)
    let totalViews = 0
    let totalLikes = 0
    let totalComments = 0

    const recentResult = await db().queryDocs({
      collection: 'news',
      filters: [{ field: 'status', operator: '==', value: 'published' }],
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      pagination: { limit: 500 },
    })

    if (recentResult.success && recentResult.data) {
      for (const row of recentResult.data) {
        const d = row.data ?? (row as Record<string, unknown>)
        totalViews += Number((d as Record<string, unknown>).views ?? 0)
        totalLikes += Number((d as Record<string, unknown>).likes ?? 0)
        totalComments += Number((d as Record<string, unknown>).comments ?? 0)
      }
    }

    return {
      totalArticles: total.success ? (total.data ?? 0) : 0,
      publishedArticles: published.success ? (published.data ?? 0) : 0,
      draftArticles: drafts.success ? (drafts.data ?? 0) : 0,
      archivedArticles: archived.success ? (archived.data ?? 0) : 0,
      totalViews,
      totalLikes,
      totalComments,
    }
  },
  ['news-stats-summary'],
  {
    revalidate: 60, // 60 seconds — stats are soft real-time
    tags: ['news-stats'],
  },
)
