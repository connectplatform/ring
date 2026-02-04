// 🚀 Entity Retrieval Service
import { Entity } from '@/features/entities/types'
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector'
import { getCachedEntities } from '@/lib/build-cache/static-data-cache'
import { initializeDatabase, getDatabaseService } from '@/lib/database'
import { auth } from '@/auth'
import { UserRole } from '@/features/auth/types'
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
 * Note: Confidential entities are only included in the results for users with CONFIDENTIAL or ADMIN roles.
 *       Other users will only see non-confidential entities matching the slugs.
 */
export const getEntitiesBySlug = cache(async (slugs: string[]): Promise<Entity[]> => {
  try {
  const phase = getCurrentPhase();
logger.info('Services: getEntitiesBySlug - Starting with slugs:', { slugs });

    // Step 1: Authenticate and get user session
    const session = await auth();
    if (!session || !session.user) {
      logger.error('Services: getEntitiesBySlug - Unauthorized access attempt');
      throw new Error('Unauthorized access');

    }

    const userRole = session.user.role as UserRole;

    // Validate role before proceeding
    const validRoles: UserRole[] = [
      UserRole.VISITOR,
      UserRole.SUBSCRIBER,
      UserRole.MEMBER,
      UserRole.ADMIN,
      UserRole.CONFIDENTIAL
    ];
    if (!userRole || !validRoles.includes(userRole)) {
      throw new Error('Invalid or missing user role');
    }

    logger.info(`Services: getEntitiesBySlug - User authenticated with role ${userRole}`);

    
    // 🚀 BUILD-TIME OPTIMIZATION: Use cached data during static generation
    if (shouldUseMockData() || (shouldUseCache() && phase.isBuildTime)) {
      logger.info(`[Service Optimization] Using ${phase.strategy} data for get-entities-by-slug`);
      
      try {
        // Return cached data based on operation type
        
        if ('get-entities-by-slug'.includes('confidential')) {
          return [];  // No cached confidential data
        }
        const entities = await getCachedEntities({ limit: 50, isPublic: true });
        const result = entities.slice(0, 10); return result;
      } catch (cacheError) {
        logger.warn('[Service Optimization] Cache fallback failed, using live data:', cacheError);
        // Continue to live data below
      }
    }

    // Step 2: Build optimized query configuration based on user role and slugs
    const queryConfig: any = {
      orderBy: [{ field: 'dateAdded', direction: 'desc' }]
    };

    // Build where clauses array
    const whereClause = [];
    
    // Add slug filtering if provided
    if (slugs.length > 0) {
      whereClause.push({ field: 'tags', operator: 'array-contains-any', value: slugs });
    }

    // Apply role-based visibility filtering for non-admin users
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.CONFIDENTIAL) {
      // For now, we'll use post-query filtering since getCachedCollectionAdvanced may not support complex OR queries
    }

    if (whereClause.length > 0) {
      queryConfig.where = whereClause;
    }

    logger.info('Services: getEntitiesBySlug - Executing optimized query')

    // Step 3: Initialize database and execute query
    await initializeDatabase()
    const db = getDatabaseService()

    // For array-contains-any, we need to handle this differently in PostgreSQL
    // Simplified: fetch all and filter in-memory for now
    const result = await db.query({
      collection: 'entities',
      orderBy: [{ field: 'dateAdded', direction: 'desc' }],
      pagination: { limit: 200 } // Fetch more for filtering
    })

    if (!result.success || !result.data) {
      logger.warn('getEntitiesBySlug: Query failed', { error: result.error })
      return []
    }

    // Step 4: Map results and apply filtering
    let entities = (Array.isArray(result.data) ? result.data : (result.data as any).data || []) as Entity[]

    // Filter by slug (array-contains-any equivalent)
    if (slugs.length > 0) {
      entities = entities.filter(entity => 
        entity.tags && entity.tags.some(tag => slugs.includes(tag))
      )
    }

    // Apply role-based visibility filtering for non-admin users
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.CONFIDENTIAL) {
      const allowedVisibilities = ['public'];
      
      if (userRole === UserRole.SUBSCRIBER || userRole === UserRole.MEMBER) {
        allowedVisibilities.push('subscriber');
      }
      if (userRole === UserRole.MEMBER) {
        allowedVisibilities.push('member');
      }

      entities = entities.filter(entity => 
        allowedVisibilities.includes(entity.visibility || 'public')
      );
    }

    logger.info(`Services: getEntitiesBySlug - Fetched ${entities.length} entities`);

    return entities;
  } catch (error) {
    logger.error('Services: getEntitiesBySlug - Error fetching entities by slug:', error);
    throw error instanceof Error 
      ? error 
      : new Error('Unknown error occurred while fetching entities by slug');
  }
})
