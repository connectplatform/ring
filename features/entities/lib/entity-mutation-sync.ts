import 'server-only'

import { revalidatePath } from 'next/cache'
import { invalidateEntitiesCache } from '@/lib/cached-data'
import { syncDiscovery, type DiscoveryMutationEvent } from '@/lib/discovery/sync-discovery'
import { logger } from '@/lib/logger'

const DEFAULT_ROLE_KEYS = ['public', 'subscriber', 'member', 'confidential', 'admin'] as const

export type EntityMutationEvent = DiscoveryMutationEvent

/**
 * Post-mutation discovery sync for entities.
 *
 * PostgreSQL JSONB is the source of truth (no separate search-index table).
 * Sync = cache tags + App Router paths + Tunnel `entity:*` events.
 */
export async function syncEntityDiscovery(params: {
  entityId: string
  event: EntityMutationEvent
  roleKeys?: readonly string[]
}): Promise<void> {
  const roleKeys = params.roleKeys ?? DEFAULT_ROLE_KEYS
  const { entityId, event } = params

  try {
    invalidateEntitiesCache([...roleKeys])
  } catch (error) {
    logger.warn('syncEntityDiscovery: cache invalidation failed', { entityId, error })
  }

  try {
    revalidatePath('/[locale]/entities', 'page')
    revalidatePath(`/[locale]/entities/${entityId}`, 'page')
    revalidatePath('/[locale]/entities/my', 'page')
    if (event === 'created' || event === 'status_changed') {
      revalidatePath('/entities', 'page')
    }
  } catch (error) {
    logger.warn('syncEntityDiscovery: revalidatePath failed', { entityId, error })
  }

  await syncDiscovery({ channel: 'entities', resourceId: entityId, event })
}
