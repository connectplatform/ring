import 'server-only'

import { revalidatePath } from 'next/cache'
import { invalidateOpportunitiesCache } from '@/lib/cached-data'
import { syncDiscovery, type DiscoveryMutationEvent } from '@/lib/discovery/sync-discovery'
import { logger } from '@/lib/logger'

const DEFAULT_ROLE_KEYS = ['public', 'subscriber', 'member', 'confidential', 'admin'] as const

export type OpportunityMutationEvent = DiscoveryMutationEvent

/**
 * Post-mutation discovery sync for opportunities.
 *
 * Ring Platform uses PostgreSQL JSONB queries (no separate search index table yet).
 * "Reindex" here means: invalidate Next cache tags, revalidate App Router paths,
 * and publish Tunnel realtime events — not a ring-db CLI reindex.
 */
export async function syncOpportunityDiscovery(params: {
  opportunityId: string
  event: OpportunityMutationEvent
  roleKeys?: readonly string[]
}): Promise<void> {
  const roleKeys = params.roleKeys ?? DEFAULT_ROLE_KEYS
  const { opportunityId, event } = params

  try {
    invalidateOpportunitiesCache([...roleKeys])
  } catch (error) {
    logger.warn('syncOpportunityDiscovery: cache invalidation failed', { opportunityId, error })
  }

  try {
    revalidatePath('/[locale]/opportunities', 'page')
    revalidatePath(`/[locale]/opportunities/${opportunityId}`, 'page')
    revalidatePath('/[locale]/opportunities/my', 'page')
    if (event === 'created' || event === 'status_changed') {
      revalidatePath('/opportunities')
    }
  } catch (error) {
    logger.warn('syncOpportunityDiscovery: revalidatePath failed', { opportunityId, error })
  }

  await syncDiscovery({ channel: 'opportunities', resourceId: opportunityId, event })
}
