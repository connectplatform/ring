// 🚀 Entity Retrieval Service - Ring-native with React 19 cache()
import { Entity } from '@/features/entities/types'
import { mapDbRowToSerializedEntity } from '@/features/entities/lib/entity-db-mapper'
import { db } from '@/lib/database'
import { auth } from '@/auth'
import { assertKnownUserRole } from '@/features/auth/user-role'
import { canViewEntity } from '@/features/entities/lib/entity-visibility-filter'
import { logger } from '@/lib/logger'
import { cache } from 'react'

/**
 * Fetches entities by matching tags in the 'slug' array, enforcing role-based access control.
 * 
 * This function performs the following steps:
 * 1. Authenticates the user and retrieves their session using Auth.js v5.
 * 2. Checks the user's role for access control.
 * 3. Queries Firestore for entities with tags matching the provided slugs.
 * 4. Applies role-based filtering to ensure users only see entities they have permission to access.
 * 5. Returns an array of entities that match the criteria and the user has permission to view.
 * 
 * User steps:
 * 1. User initiates a request to fetch entities by slug (e.g., from a search or filter function).
 * 2. The function authenticates the user and determines their role.
 * 3. The function queries the database for matching entities.
 * 4. The function filters the results based on the user's role and entity visibility.
 * 5. The filtered list of entities is returned to the user.
 * 
 * @param {string[]} slugs - An array of slug strings to match against entity tags.
 * @returns {Promise<Entity[]>} A promise that resolves to an array of Entity objects matching the given slugs.
 * @throws {Error} If the user is not authenticated or an error occurs during the fetch operation.
 * 
 * Note: Confidential entities are only included in the results for users with confidential or admin roles.
 *       Other users will only see non-confidential entities matching the slugs.
 */
export const getEntitiesBySlug = cache(async (slugs: string[]): Promise<Entity[]> => {
  try {
    logger.info('Services: getEntitiesBySlug - Starting with slugs:', { slugs });

    // Step 1: Authenticate and get user session
    const session = await auth();
    if (!session || !session.user) {
      logger.error('Services: getEntitiesBySlug - Unauthorized access attempt');
      throw new Error('Unauthorized access');
    }

    const userRole = assertKnownUserRole(session.user.role)

    logger.info(`Services: getEntitiesBySlug - User authenticated with role ${userRole}`);

    logger.info('Services: getEntitiesBySlug - Executing query with DatabaseService')

    // Step 3: Execute query
    const result = await db().queryDocs<Record<string, unknown> & { id: string }>({
      collection: 'entities',
      orderBy: [{ field: 'dateAdded', direction: 'desc' }],
      pagination: { limit: 200 },
    })

    if (!result.success || !result.data) {
      logger.warn('getEntitiesBySlug: Query failed', { error: result.error })
      return []
    }

    // Step 4: Map results and apply filtering
    let entities = result.data.map((row) =>
      mapDbRowToSerializedEntity(row.id, row) as unknown as Entity
    )

    // Filter by slug (array-contains-any equivalent)
    if (slugs.length > 0) {
      entities = entities.filter(entity => 
        entity.tags && entity.tags.some(tag => slugs.includes(tag))
      )
    }

    entities = entities.filter((entity) => canViewEntity(entity, { userRole }))

    logger.info(`Services: getEntitiesBySlug - Fetched ${entities.length} entities`);

    return entities;
  } catch (error) {
    logger.error('Services: getEntitiesBySlug - Error fetching entities by slug:', error);
    throw error instanceof Error 
      ? error 
      : new Error('Unknown error occurred while fetching entities by slug');
  }
})
