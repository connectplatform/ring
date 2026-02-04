/**
 * Get Entities Service
 * 
 * Retrieves entities from PostgreSQL with advanced filtering
 * Uses React 19 patterns and DatabaseService abstraction
 */

import { Entity, SerializedEntity, EntityType } from '@/features/entities/types'
import { serializeEntities } from '@/lib/converters/entity-serializer'
import { UserRole } from '@/features/auth/types'
import { auth } from '@/auth'
import { logger } from '@/lib/logger'
import { EntityAuthError, EntityPermissionError, EntityQueryError, EntityDatabaseError, logRingError } from '@/lib/errors'
import { initializeDatabase, getDatabaseService } from '@/lib/database'
import { cache } from 'react'

/**
 * Advanced entity filtering interface
 */
export interface EntityFilters {
  search?: string
  types?: EntityType[]
  location?: string
  employeeCountMin?: number
  employeeCountMax?: number
  foundedYearMin?: number
  foundedYearMax?: number
  verificationStatus?: 'all' | 'verified' | 'unverified' | 'premium'
  membershipTier?: 'all' | 'subscriber' | 'member' | 'confidential'
  hasCertifications?: boolean
  hasPartnerships?: boolean
  services?: string[]
  sortBy?: 'dateAdded' | 'name' | 'employeeCount' | 'foundedYear' | 'memberSince'
  sortOrder?: 'asc' | 'desc'
}

/**
 * Fetch a paginated list of entities based on user role with advanced filtering.
 * 
 * React 19 cache() wrapper applied for request deduplication within same request cycle.
 * 
 * This function performs the following steps:
 * 1. Authenticates the user and retrieves their session information.
 * 2. Builds a query based on the user's role and applies appropriate filters.
 * 3. Applies advanced filtering based on provided filter parameters.
 * 4. Implements pagination using the 'limit' and 'startAfter' parameters.
 * 5. Executes the query via DatabaseService and processes the results.
 * 6. Maps the document snapshots to Entity objects, including their IDs.
 * 7. Determines the ID of the last visible entity for future pagination.
 * 
 * @param {object} params - Parameters object
 * @param {UserRole} params.userRole - The role of the requesting user
 * @param {number} [params.limit] - The maximum number of entities to fetch per page. Defaults to 20.
 * @param {string} [params.startAfter] - The ID of the last entity from the previous page for pagination. Optional.
 * @param {EntityFilters} [params.filters] - Advanced filtering options. Optional.
 * @returns {Promise<{ entities: SerializedEntity[]; lastVisible: string | null; totalCount?: number }>} A promise that resolves to an object containing the serialized entities and the ID of the last visible entity for pagination.
 * @throws {EntityAuthError} If the user is not authenticated
 * @throws {EntityDatabaseError} If there's an error accessing the database
 * @throws {EntityQueryError} If there's an error executing the query
 */
export const getEntitiesForRole = cache(async (
  params: { 
    userRole: UserRole; 
    limit?: number; 
    startAfter?: string;
    filters?: EntityFilters;
  }
): Promise<{ entities: SerializedEntity[]; lastVisible: string | null; totalCount?: number }> => {
  const { userRole, limit = 20, startAfter, filters } = params
  try {
    console.log('Services: getEntitiesForRole - Starting...', { userRole, limit, startAfter, filters })

    // Validate role before proceeding to ensure only authenticated users with valid roles can access entities
    const validRoles: UserRole[] = [
      UserRole.VISITOR,
      UserRole.SUBSCRIBER,
      UserRole.MEMBER,
      UserRole.ADMIN,
      UserRole.CONFIDENTIAL
    ]

    if (!userRole || !validRoles.includes(userRole)) {
      throw new EntityPermissionError('Invalid or missing user role', undefined, {
        timestamp: Date.now(),
        hasRole: !!userRole,
        role: userRole,
        operation: 'role_validation'
      });
    }

    // Initialize database
    await initializeDatabase()
    const db = getDatabaseService()

    // Step 2: Build optimized query configuration based on user role and filters
    const queryConfig: any = {
      limit,
      orderBy: []
    };

    // Initialize where conditions array
    const whereConditions: any[] = [];

    // Apply role-based filtering for non-admin users
    // Visitors see only public. Subscribers see public + subscriber. Members see public + subscriber + member.
    if (userRole === UserRole.VISITOR) {
      whereConditions.push({ field: 'visibility', operator: 'in', value: ['public'] });
    } else if (userRole === UserRole.SUBSCRIBER) {
      whereConditions.push({ field: 'visibility', operator: 'in', value: ['public', 'subscriber'] });
    } else if (userRole === UserRole.MEMBER) {
      whereConditions.push({ field: 'visibility', operator: 'in', value: ['public', 'subscriber', 'member'] });
    }
    // ADMIN and CONFIDENTIAL users see all entities (no filter applied)

    // Apply advanced filters if provided
    if (filters) {
      // Entity type filtering
      if (filters.types && filters.types.length > 0) {
        whereConditions.push({ field: 'type', operator: 'in', value: filters.types });
      }

      // Employee count filtering
      if (filters.employeeCountMin !== undefined) {
        whereConditions.push({ field: 'employeeCount', operator: '>=', value: filters.employeeCountMin });
      }
      if (filters.employeeCountMax !== undefined) {
        whereConditions.push({ field: 'employeeCount', operator: '<=', value: filters.employeeCountMax });
      }

      // Founded year filtering
      if (filters.foundedYearMin !== undefined) {
        whereConditions.push({ field: 'foundedYear', operator: '>=', value: filters.foundedYearMin });
      }
      if (filters.foundedYearMax !== undefined) {
        whereConditions.push({ field: 'foundedYear', operator: '<=', value: filters.foundedYearMax });
      }

      // Certification filtering
      if (filters.hasCertifications === true) {
        whereConditions.push({ field: 'certifications', operator: '!=', value: null });
      } else if (filters.hasCertifications === false) {
        whereConditions.push({ field: 'certifications', operator: '==', value: null });
      }

      // Partnership filtering
      if (filters.hasPartnerships === true) {
        whereConditions.push({ field: 'partnerships', operator: '!=', value: null });
      } else if (filters.hasPartnerships === false) {
        whereConditions.push({ field: 'partnerships', operator: '==', value: null });
      }

      // Membership tier filtering (applies additional visibility constraints)
      if (filters.membershipTier && filters.membershipTier !== 'all') {
        if (filters.membershipTier === 'confidential') {
          whereConditions.push({ field: 'isConfidential', operator: '==', value: true });
        } else {
          whereConditions.push({ field: 'visibility', operator: '==', value: filters.membershipTier });
        }
      }

      // Sorting configuration
      const sortField = filters.sortBy || 'dateAdded';
      const sortDirection = filters.sortOrder || 'desc';
      queryConfig.orderBy.push({ field: sortField, direction: sortDirection });
    } else {
      // Default sorting
      queryConfig.orderBy.push({ field: 'dateAdded', direction: 'desc' });
    }

    // Apply where conditions to query config
    if (whereConditions.length > 0) {
      queryConfig.where = whereConditions;
    }

    // Note: Pagination with startAfter is handled via offset in DatabaseService query

    // Step 3: Execute database query
    let entities: Entity[] = []
    try {
      // Convert queryConfig to DatabaseService format
      const dbFilters = whereConditions.map((condition: any) => ({
        field: condition.field,
        operator: condition.operator === '==' ? '=' : condition.operator,
        value: condition.value
      }))

      const result = await db.query({
        collection: 'entities',
        filters: dbFilters,
        orderBy: queryConfig.orderBy?.map((order: any) => ({
          field: order.field,
          direction: order.direction
        })),
        pagination: { limit: queryConfig.limit }
      })

      if (!result.success || !result.data) {
        throw new EntityQueryError(
          'Failed to execute entities query',
          result.error || new Error('Unknown error'),
          {
            timestamp: Date.now(),
            userRole,
            limit,
            startAfter,
            operation: 'query_execution'
          }
        )
      }

      // Extract entities from result
      const rawEntities = Array.isArray(result.data) ? result.data : (result.data as any).data || []
      entities = rawEntities.map((doc: any) => ({
        ...(doc.data || doc),
        id: doc.id
      })) as Entity[]

    } catch (error) {
      throw new EntityQueryError(
        'Failed to execute entities query',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          userRole,
          limit,
          startAfter,
          operation: 'query_execution'
        }
      )
    }

    // Step 4: Entity objects mapped from database

    // Step 5: Apply client-side filtering for complex queries that can't be done in Firestore
    if (filters) {
      // Search filtering (client-side for complex text search)
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        entities = entities.filter(entity => {
          const searchableText = [
            entity.name,
            entity.shortDescription,
            entity.fullDescription,
            entity.location,
            ...(entity.services || []),
            ...(entity.industries || []),
            ...(entity.tags || [])
          ].join(' ').toLowerCase();
          
          return searchableText.includes(searchTerm);
        });
      }

      // Location filtering (client-side for fuzzy matching)
      if (filters.location) {
        const locationTerm = filters.location.toLowerCase();
        entities = entities.filter(entity => 
          entity.location?.toLowerCase().includes(locationTerm)
        );
      }

      // Services filtering (client-side for array contains)
      if (filters.services && filters.services.length > 0) {
        entities = entities.filter(entity => 
          entity.services?.some(service => 
            filters.services!.some(filterService => 
              service.toLowerCase().includes(filterService.toLowerCase())
            )
          )
        );
      }

      // Verification status filtering (client-side for complex logic)
      if (filters.verificationStatus && filters.verificationStatus !== 'all') {
        entities = entities.filter(entity => {
          const hasCertifications = entity.certifications && entity.certifications.length > 0;
          const hasPartnerships = entity.partnerships && entity.partnerships.length > 0;
          
          switch (filters.verificationStatus) {
            case 'verified':
              return hasCertifications;
            case 'unverified':
              return !hasCertifications;
            case 'premium':
              return hasCertifications && hasPartnerships;
            default:
              return true;
          }
        });
      }
    }

    // Step 6: Serialize entities for client component compatibility
    const serializedEntities = serializeEntities(entities)

    // Step 7: Get the ID of the last visible entity for pagination
    const lastVisible = entities.length > 0 ? entities[entities.length - 1].id : null

    logger.info('Services: getEntitiesForRole - Total entities fetched:', { 
      entities: serializedEntities.length, 
      lastVisible,
      filtersApplied: !!filters 
    })

    return { 
      entities: serializedEntities, 
      lastVisible,
      totalCount: serializedEntities.length 
    }
  } catch (error) {
    // Enhanced error logging with cause information using centralized logger
    logRingError(error, 'Services: getEntitiesForRole - Error')
    
    // Re-throw known errors, wrap unknown errors
    if (error instanceof EntityPermissionError ||
        error instanceof EntityQueryError ||
        error instanceof EntityDatabaseError) {
      throw error;
    }
    
    throw new EntityQueryError(
      'Unknown error occurred while fetching entities',
      error instanceof Error ? error : new Error(String(error)),
      {
        timestamp: Date.now(),
        operation: 'getEntitiesForRole'
      }
    );
  }
});

// Convenience wrapper for contexts where dynamic session access is allowed (not inside caches)
// React 19 cache() wrapper applied
export const getEntities = cache(async (
  limit: number = 20,
  startAfter?: string,
  filters?: EntityFilters
): Promise<{ entities: SerializedEntity[]; lastVisible: string | null; totalCount?: number }> => {
  logger.info('Services: getEntities - Starting...')
  const session = await auth()
  if (!session || !session.user) {
    throw new EntityAuthError('Unauthorized access', undefined, {
      timestamp: Date.now(),
      hasSession: !!session,
      hasUser: !!session?.user,
      operation: 'getEntities'
    });
  }
  const userRole = session.user.role as UserRole
  return getEntitiesForRole({ userRole, limit, startAfter, filters })
});

/**
 * Fetch all confidential entities.
 * 
 * React 19 cache() wrapper applied for request deduplication.
 * 
 * @returns {Promise<Entity[]>} A promise that resolves to an array of confidential entities.
 * @throws {EntityAuthError} If the user is not authenticated
 * @throws {EntityPermissionError} If the user lacks sufficient permissions
 * @throws {EntityDatabaseError} If there's an error accessing the database
 * @throws {EntityQueryError} If there's an error executing the query
 */
export const getConfidentialEntities = cache(async (): Promise<Entity[]> => {
  try {
    logger.info('Services: getConfidentialEntities - Starting...')

    // Step 1: Authenticate and get user session
    const session = await auth()
    if (!session || !session.user) {
      throw new EntityAuthError('Unauthorized access', undefined, {
        timestamp: Date.now(),
        hasSession: !!session,
        hasUser: !!session?.user,
        operation: 'getConfidentialEntities'
      });
    }

    const userRole = session.user.role as UserRole

    // Step 2: Validate user role and permissions
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.CONFIDENTIAL) {
      throw new EntityPermissionError(
        'Access denied. Only ADMIN or CONFIDENTIAL users can fetch confidential entities.',
        undefined,
        {
          timestamp: Date.now(),
          userRole,
          requiredRoles: [UserRole.ADMIN, UserRole.CONFIDENTIAL],
          operation: 'getConfidentialEntities'
        }
      );
    }

    logger.info(`Services: getConfidentialEntities - User authenticated with role ${userRole}`)

    // Step 3: Initialize database and execute query for confidential entities
    await initializeDatabase()
    const db = getDatabaseService()

    let confidentialEntities: Entity[] = []
    try {
      const result = await db.query({
        collection: 'entities',
        filters: [{ field: 'isConfidential', operator: '=', value: true }],
        orderBy: [{ field: 'dateAdded', direction: 'desc' }]
      })

      if (!result.success || !result.data) {
        throw new EntityQueryError(
          'Failed to execute confidential entities query',
          result.error || new Error('Unknown error'),
          {
            timestamp: Date.now(),
            userRole,
            operation: 'confidential_query_execution'
          }
        )
      }

      // Extract and map entities
      const rawEntities = Array.isArray(result.data) ? result.data : (result.data as any).data || []
      confidentialEntities = rawEntities.map((doc: any) => ({
        ...(doc.data || doc),
        id: doc.id
      })) as Entity[]

    } catch (error) {
      throw new EntityQueryError(
        'Failed to execute confidential entities query',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          userRole,
          operation: 'confidential_query_execution'
        }
      )
    }

    // Step 5: Return resulting confidential entities

    logger.info('Services: getConfidentialEntities - Total confidential entities fetched:', { confidentialEntities: confidentialEntities.length })

    return confidentialEntities
  } catch (error) {
    // Enhanced error logging with cause information using centralized logger
    logRingError(error, 'Services: getConfidentialEntities - Error')
    
    // Re-throw known errors, wrap unknown errors
    if (error instanceof EntityAuthError || 
        error instanceof EntityPermissionError ||
        error instanceof EntityQueryError ||
        error instanceof EntityDatabaseError) {
      throw error;
    }
    
    throw new EntityQueryError(
      'Unknown error occurred while fetching confidential entities',
      error instanceof Error ? error : new Error(String(error)),
      {
        timestamp: Date.now(),
        operation: 'getConfidentialEntities'
      }
    );
  }
});

/**
 * Batch fetch multiple entities by their IDs with role-based filtering.
 * 
 * This function is optimized for scenarios where you need to retrieve multiple
 * specific entities at once (e.g., 20+ entities by ID) with automatic caching
 * and request deduplication.
 * 
 * React 19 cache() wrapper applied for request deduplication.
 * 
 * @param entityIds - Array of entity IDs to fetch
 * @param userRole - The role of the requesting user
 * @returns Promise<Entity[]> - Array of entities the user can access
 * @throws {EntityAuthError} If the user is not authenticated
 * @throws {EntityPermissionError} If the user lacks sufficient permissions
 * @throws {EntityQueryError} If there's an error executing the batch query
 */
export const getEntitiesByIds = cache(async (
  entityIds: string[],
  userRole?: UserRole
): Promise<Entity[]> => {
  try {
    logger.info('Services: getEntitiesByIds - Starting batch fetch...', { entityIds: entityIds.length, userRole })

    // If no userRole provided, get from session
    let role = userRole;
    if (!role) {
      const session = await auth();
      if (!session || !session.user) {
        throw new EntityAuthError('Unauthorized access', undefined, {
          timestamp: Date.now(),
          hasSession: !!session,
          hasUser: !!session?.user,
          operation: 'getEntitiesByIds'
        });
      }
      role = session.user.role as UserRole;
    }

    if (!entityIds || entityIds.length === 0) {
      return [];
    }

    // Limit batch size for performance (Firestore has limits)
    const maxBatchSize = 100;
    if (entityIds.length > maxBatchSize) {
      logger.warn(`Services: getEntitiesByIds - Batch size ${entityIds.length} exceeds maximum ${maxBatchSize}, truncating`);
      entityIds = entityIds.slice(0, maxBatchSize);
    }

    // Step 1 & 2: Execute batch retrieval using database query with 'in' operator
    await initializeDatabase()
    const db = getDatabaseService()
    
    let documents: Entity[] = []
    try {
      const result = await db.query({
        collection: 'entities',
        filters: [{ field: 'id', operator: 'in', value: entityIds }]
      })

      if (!result.success || !result.data) {
        throw new EntityQueryError(
          'Failed to execute batch entity retrieval',
          result.error || new Error('Unknown error'),
          {
            timestamp: Date.now(),
            userRole: role,
            batchSize: entityIds.length,
            operation: 'batch_entity_retrieval'
          }
        )
      }

      const rawEntities = Array.isArray(result.data) ? result.data : (result.data as any).data || []
      documents = rawEntities.map((doc: any) => ({
        ...(doc.data || doc),
        id: doc.id
      }))

    } catch (error) {
      throw new EntityQueryError(
        'Failed to execute batch entity retrieval',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          userRole: role,
          batchSize: entityIds.length,
          operation: 'batch_entity_retrieval'
        }
      )
    }

    // Step 3: Apply role-based filtering
    const entities: Entity[] = []
    
    documents.forEach((entity) => {
      const canView = canUserViewEntity(entity, role)
      if (canView) {
        entities.push(entity)
      }
    })

    logger.info('Services: getEntitiesByIds - Batch fetch completed:', {
      requested: entityIds.length,
      found: documents.length,
      accessible: entities.length,
      userRole: role
    });

    return entities;

  } catch (error) {
    logRingError(error, 'Services: getEntitiesByIds - Error')
    
    if (error instanceof EntityAuthError || 
        error instanceof EntityPermissionError ||
        error instanceof EntityQueryError) {
      throw error;
    }
    
    throw new EntityQueryError(
      'Unknown error occurred while batch fetching entities',
      error instanceof Error ? error : new Error(String(error)),
      {
        timestamp: Date.now(),
        operation: 'getEntitiesByIds'
      }
    );
  }
});

/**
 * Helper function to determine if a user can view a specific entity
 * based on their role and the entity's visibility settings.
 */
function canUserViewEntity(entity: Entity, userRole: UserRole): boolean {
  // ADMIN and CONFIDENTIAL users can see all entities
  if (userRole === UserRole.ADMIN || userRole === UserRole.CONFIDENTIAL) {
    return true;
  }

  // Check confidential entities
  if (entity.isConfidential) {
    return false; // Only ADMIN and CONFIDENTIAL can see these
  }

  // Check visibility based on role hierarchy
  switch (userRole) {
    case UserRole.VISITOR:
      return entity.visibility === 'public';
    case UserRole.SUBSCRIBER:
      return ['public', 'subscriber'].includes(entity.visibility || 'public');
    case UserRole.MEMBER:
      return ['public', 'subscriber', 'member'].includes(entity.visibility || 'public');
    default:
      return false;
  }
}

