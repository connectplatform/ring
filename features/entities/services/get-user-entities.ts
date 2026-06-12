/**
 * Get User Entities Service
 *
 * React 19 cache() wrapper for user-specific entity queries (PostgreSQL / DatabaseService).
 */

import { cache } from 'react'
import type { SerializedEntity } from '@/features/entities/types'
import { auth } from '@/auth'
import { EntityAuthError, EntityQueryError, logRingError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { db } from '@/lib/database'
import {
  mapDbDocumentToSerializedEntity,
} from '@/features/entities/lib/entity-db-mapper'
import {
  type MyEntitiesView,
  type MyEntitiesCounts,
  computeMyEntitiesCounts,
  matchesMyEntitiesView,
} from '@/features/entities/lib/my-entities-views'

const MY_ENTITIES_FETCH_CAP = 200

/**
 * Entities created by a user (capped for dashboard filtering).
 */
export const getUserCreatedEntities = cache(async (
  userId: string,
  limit: number = MY_ENTITIES_FETCH_CAP,
): Promise<{ entities: SerializedEntity[]; lastVisible: string | null }> => {
  try {
    logger.info('Services: getUserCreatedEntities', { userId, limit })

    const queryResult = await db().queryDocs({
      collection: 'entities',
      filters: [{ field: 'addedBy', operator: '=', value: userId }],
      orderBy: [{ field: 'dateAdded', direction: 'desc' as const }],
      pagination: { limit },
    })

    const entities: SerializedEntity[] = []
    if (queryResult.success && queryResult.data) {
      for (const item of queryResult.data) {
        entities.push(mapDbDocumentToSerializedEntity(item))
      }
    }

    const lastVisible = entities.length > 0 ? entities[entities.length - 1].id : null
    return { entities, lastVisible }
  } catch (error) {
    logRingError(error, 'getUserCreatedEntities: Error')
    throw new EntityQueryError(
      'Failed to fetch user entities',
      error instanceof Error ? error : new Error(String(error)),
      { timestamp: Date.now(), userId, operation: 'getUserCreatedEntities' },
    )
  }
})

/**
 * Entities where the user is a member but not the creator.
 */
export const getUserMemberEntities = cache(async (
  userId: string,
  limit: number = MY_ENTITIES_FETCH_CAP,
): Promise<SerializedEntity[]> => {
  try {
    const queryResult = await db().queryDocs({
      collection: 'entities',
      filters: [{ field: 'members', operator: 'array-contains', value: userId }],
      orderBy: [{ field: 'dateAdded', direction: 'desc' as const }],
      pagination: { limit },
    })

    if (!queryResult.success || !queryResult.data) return []

    return queryResult.data
      .map((item) => mapDbDocumentToSerializedEntity(item))
      .filter((entity) => entity.addedBy !== userId)
  } catch (error) {
    logRingError(error, 'getUserMemberEntities: Error')
    return []
  }
})

/**
 * Current user's entities for My Entities page.
 */
export const getMyEntities = cache(async (
  view: MyEntitiesView = 'all',
  limit: number = 50,
): Promise<{
  entities: SerializedEntity[]
  lastVisible: string | null
  counts: MyEntitiesCounts
}> => {
  const session = await auth()

  if (!session?.user) {
    throw new EntityAuthError('Authentication required', undefined, {
      timestamp: Date.now(),
      operation: 'getMyEntities',
    })
  }

  const userId = session.user.id

  try {
    const [created, memberEntities] = await Promise.all([
      getUserCreatedEntities(userId, MY_ENTITIES_FETCH_CAP),
      getUserMemberEntities(userId, MY_ENTITIES_FETCH_CAP),
    ])

    const pool =
      view === 'member'
        ? memberEntities
        : created.entities.filter((entity) =>
            matchesMyEntitiesView(entity, userId, view),
          )

    const entities = pool.slice(0, limit)
    const counts = computeMyEntitiesCounts(
      [...created.entities, ...memberEntities],
      userId,
    )

    return {
      entities,
      lastVisible: entities.length > 0 ? entities[entities.length - 1].id : null,
      counts,
    }
  } catch (error) {
    logRingError(error, 'getMyEntities: Error')
    throw error
  }
})
