import 'server-only'

import { revalidatePath } from 'next/cache'
import { invalidateNewsStatsCache } from '@/lib/cached-data'
import { logger } from '@/lib/logger'

export type NewsMutationEvent = 'created' | 'updated' | 'deleted' | 'published' | 'status_changed'

/**
 * Post-mutation cache sync for news.
 *
 * Invalidates the `news-stats` cache tag (admin sidebar lightweight aggregate)
 * and revalidates App Router paths for admin news pages.
 *
 * Unlike entity/opportunity sync, news does NOT publish Tunnel realtime events
 * (no realtime feed for news articles).
 */
export async function syncNewsDiscovery(params: {
  articleId?: string
  event: NewsMutationEvent
  locale?: string
}): Promise<void> {
  const { articleId, event, locale } = params

  // Step 1: Invalidate news-stats cache tag (admin sidebar)
  try {
    invalidateNewsStatsCache()
  } catch (error) {
    logger.warn('syncNewsDiscovery: cache invalidation failed', { articleId, error })
  }

  // Step 2: Revalidate App Router paths for admin news pages
  try {
    revalidatePath('/[locale]/admin/news', 'page')
    revalidatePath('/[locale]/admin/news/analytics', 'page')
    revalidatePath('/[locale]/admin/news/categories', 'page')
    revalidatePath('/[locale]/admin/news/bulk', 'page')
    if (articleId) {
      revalidatePath(`/[locale]/admin/news/edit/${articleId}`, 'page')
    }
    // Revalidate public news page if locale provided
    if (locale) {
      revalidatePath(`/${locale}/news`)
    }
  } catch (error) {
    logger.warn('syncNewsDiscovery: revalidatePath failed', { articleId, error })
  }
}
