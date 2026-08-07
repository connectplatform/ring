/**
 * Get Entities Service
 * 
 * Retrieves entities from PostgreSQL with advanced filtering.
 * Uses React 19/Next 16 patterns and DatabaseService abstraction.
 * 
 * // TODO: Prefer React.cache (React 19) for deduplication here, which is already implemented.
 * // TODO: Consider replacing console.log with logger.debug/info (already used in most places).
 * // TODO: Evaluate usage of React Server Actions and useOptimistic for instant feedback in future (not directly applicable here).
 */

import { SerializedEntity, EntityType } from '@/features/entities/types'
import { mapDbDocumentToSerializedEntity } from '@/features/entities/lib/entity-db-mapper'
import { UserRolesArray } from '@/features/auth/user-role'
import { assertKnownUserRole, hasConfidentialAccess } from '@/features/auth/user-role'
import { auth } from '@/auth'
import { logger } from '@/lib/logger'
import { EntityAuthError, EntityPermissionError, EntityQueryError, EntityDatabaseError, logRingError } from '@/lib/errors'
import { db } from '@/lib/database'
import { computePaginationCursor } from '@/lib/pagination/cursor-pagination'
import { filterEntitiesForDiscovery, buildEntityVisibilityFilters, canViewEntity } from '@/features/entities/lib/entity-visibility-filter'
import { entityMatchesVerificationFilter } from '@/features/entities/lib/entity-verification-resolver'
import { getUserBlockedEntityIds } from '@/features/entities/services/entity-moderation'
import { cache } from 'react'

/**
 * Advanced entity filtering interface for querying entities with various options.
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
 * Fetches a paginated list of entities for a specific user role with advanced filtering.
 * Wrapped in React cache() for deduplication across the RSC cycle.
 * 
 * @param {object} params- Contains userRole, pagination and filter options.
 * @returns {Promise<{ entities: SerializedEntity[]; lastVisible: string | null; totalCount?: number }>} - Paginated, filtered, and authorized entities.
 * @throws {EntityAuthError|EntityDatabaseError|EntityQueryError}
 */
export const getEntitiesForRole = cache(async (
  params: { 
    userRole: UserRolesArray; 
    limit?: number; 
    startAfter?: string;
    filters?: EntityFilters;
  }
): Promise<{ entities: SerializedEntity[]; lastVisible: string | null; totalCount?: number }> => {
  // Destructure parameters with defaults.
  const { userRole: rawRole, limit = 20, startAfter, filters } = params

  // Assert the user role with helper (prevents typos/unknown roles)
  const userRole = assertKnownUserRole(rawRole)

  try {
    // Log fetch attempt at info level with parameters for observability.
    logger.info('Services: getEntitiesForRole - Starting...', { userRole, rawRole, limit, startAfter, filters })

    // Defensive: Ensure role is valid (double assertion in case upstream typing is bypassed).
    assertKnownUserRole(userRole)

    // Build database query configuration.
    const queryConfig: any = {
      limit,
      orderBy: [] // Collected sorting options applied downstream
    };

    // All SQL 'where' conditions are gathered in this array for translation to DB constraints.
    const whereConditions: any[] = [];

    // Step 1: Add role-based visibility filters. These prevent non-authorized data exposure.
    // Visibility rules are defined centrally in entity-visibility-filter for SSOT.
    const visibilityFilters = buildEntityVisibilityFilters(userRole)
    for (const vf of visibilityFilters) {
      whereConditions.push(vf)
    }

    // Step 2: Add filters from request, supporting a wide range of entity properties.
    if (filters) {
      // Filter by entity type if array provided.
      if (filters.types && filters.types.length > 0) {
        whereConditions.push({ field: 'type', operator: 'in', value: filters.types });
      }

      // Min employee count.
      if (filters.employeeCountMin !== undefined) {
        whereConditions.push({ field: 'employeeCount', operator: '>=', value: filters.employeeCountMin });
      }
      // Max employee count.
      if (filters.employeeCountMax !== undefined) {
        whereConditions.push({ field: 'employeeCount', operator: '<=', value: filters.employeeCountMax });
      }

      // Founded year lower/upper bounds.
      if (filters.foundedYearMin !== undefined) {
        whereConditions.push({ field: 'foundedYear', operator: '>=', value: filters.foundedYearMin });
      }
      if (filters.foundedYearMax !== undefined) {
        whereConditions.push({ field: 'foundedYear', operator: '<=', value: filters.foundedYearMax });
      }

      // Filter entities with/without certifications (null means none).
      if (filters.hasCertifications === true) {
        whereConditions.push({ field: 'certifications', operator: '!=', value: null });
      } else if (filters.hasCertifications === false) {
        whereConditions.push({ field: 'certifications', operator: '==', value: null });
      }

      // Partnerships filter is similar to certifications.
      if (filters.hasPartnerships === true) {
        whereConditions.push({ field: 'partnerships', operator: '!=', value: null });
      } else if (filters.hasPartnerships === false) {
        whereConditions.push({ field: 'partnerships', operator: '==', value: null });
      }

      // Membership tier controls further visibility. 'all' disables this filter.
      if (filters.membershipTier && filters.membershipTier !== 'all') {
        if (filters.membershipTier === 'confidential') {
          whereConditions.push({ field: 'isConfidential', operator: '==', value: true });
        } else {
          whereConditions.push({ field: 'visibility', operator: '==', value: filters.membershipTier });
        }
      }

      // Sort field and direction (default = newest first)
      const sortField = filters.sortBy || 'dateAdded';
      const sortDirection = filters.sortOrder || 'desc';
      queryConfig.orderBy.push({ field: sortField, direction: sortDirection });
    } else {
      // No custom filters: default sorting by newest.
      queryConfig.orderBy.push({ field: 'dateAdded', direction: 'desc' });
    }

    // Attach built 'where' conditions to config if any exist.
    if (whereConditions.length > 0) {
      queryConfig.where = whereConditions;
    }

    // Step 3: Add pagination via startAfter cursor (based on record's dateAdded or unique id).
    if (startAfter) {
      try {
        // Fetch the document for startAfter id to get its sorting property (dateAdded).
        const cursorResult = await db().findDocById('entities', startAfter)
        if (cursorResult.success && cursorResult.data) {
          // Try to get the cursor value from the document: support snake_case and camelCase.
          const cursorDate =
            (cursorResult.data as { dateAdded?: string; date_added?: string }).dateAdded ??
            (cursorResult.data as { date_added?: string }).date_added
          if (cursorDate) {
            // For strict ordering, fetch records after this 'dateAdded'.
            whereConditions.push({ field: 'dateAdded', operator: '<', value: cursorDate })
            queryConfig.where = whereConditions
          } else {
            // Fallback: fallback to id-based exclusion if no date is present.
            whereConditions.push({ field: 'id', operator: '!=', value: startAfter })
            queryConfig.where = whereConditions
          }
        }
      } catch {
        // If any error, continue without cursor (first page semantics).
        // TODO: Consider silently handling or optionally reporting if pagination goes off the rails.
      }
    }

    // Step 4: Query entities from the DB using the built config.
    let entities: SerializedEntity[] = []
    try {
      // Translate operator '==' to '=' and apply other mappings as needed for DB layer.
      const dbFilters = whereConditions.map((condition: any) => ({
        field: condition.field,
        operator: condition.operator === '==' ? '=' : condition.operator,
        value: condition.value
      }))

      // Actually perform query against the datastore.
      const result = await db().queryDocs({
        collection: 'entities',
        filters: dbFilters,
        orderBy: queryConfig.orderBy?.map((order: any) => ({
          field: order.field,
          direction: order.direction,
        })),
        pagination: { limit: queryConfig.limit },
      })

      // Fail safely if DB query result is not valid.
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

      // Map each DB doc to proper entity for the API.
      entities = result.data.map((doc) => mapDbDocumentToSerializedEntity(doc))
    } catch (error) {
      // Any error here is considered a DB/query error.
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

    // Step 5: Apply client-side filtering for cases the DB can't tackle (eg. fuzzy or deep text search, array search).
    if (filters) {
      // Search on multiple text fields using .includes; not every DB has full-text search. Not optimal for large result sets!
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        entities = entities.filter(entity => {
          // Join searchable fields, including arrays, and search in the full string.
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

      // Fuzzy location match (e.g., "New York" should catch "New York, NY, USA").
      if (filters.location) {
        const locationTerm = filters.location.toLowerCase();
        entities = entities.filter(entity =>
          entity.location?.toLowerCase().includes(locationTerm)
        );
      }

      // Services filter: Look for ANY overlap between the array of requested services and the entity's services.
      if (filters.services && filters.services.length > 0) {
        entities = entities.filter(entity =>
          entity.services?.some(service =>
            filters.services!.some(filterService =>
              service.toLowerCase().includes(filterService.toLowerCase())
            )
          )
        );
      }

      // Post-query filtering for verification status, using business logic (e.g. status computation or external flag).
      if (filters.verificationStatus && filters.verificationStatus !== 'all') {
        entities = entities.filter((entity) =>
          entityMatchesVerificationFilter(entity, filters.verificationStatus!)
        )
      }
    }

    // Step 6: Apply blocked entities filtering and discovery filtering (eg. no banned/blocked entities in lists).
    const session = await auth()
    // Fetch the list of entityIds blocked for this user. Requires session.user.id.
    const blockedEntityIds = session?.user?.id
      ? await getUserBlockedEntityIds(session.user.id)
      : []

    // filterEntitiesForDiscovery applies blocks, suspends, shadow bans, etc.
    entities = filterEntitiesForDiscovery(entities, {
      userId: session?.user?.id,
      userRole,
      blockedEntityIds,
    })

    // Step 7: Compute pagination cursor based on returned entity list.
    // TODO: Consider native Next.js RSC streaming APIs for infinite scroll pagination.
    const { nextCursor: lastVisible } = computePaginationCursor(
      entities,
      limit,
      (entity) => entity.id,
    )

    // Log the amount of entities fetched and if filtering was applied for metrics/audit.
    logger.info('Services: getEntitiesForRole - Total entities fetched:', {
      entities: entities.length,
      lastVisible,
      filtersApplied: !!filters
    })

    // Return the list, cursor for next page, and total count (limited to current result size).
    return {
      entities,
      lastVisible,
      totalCount: entities.length
    }
  } catch (error) {
    // Enhanced error logging to centralized logger, capturing the stack and cause.
    logRingError(error, 'Services: getEntitiesForRole - Error')

    // Passthrough of known errors, everything else is wrapped as a generic query error.
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

/**
 * Retrieve entities with automatic role extraction from authenticated session.
 * This function is a convenience wrapper for RSC/client/server edge calls where a session is available.
 * Uses React 19 cache() for deduplication.
 */
export const getEntities = cache(async (
  limit: number = 20,
  startAfter?: string,
  filters?: EntityFilters
): Promise<{ entities: SerializedEntity[]; lastVisible: string | null; totalCount?: number }> => {
  logger.info('Services: getEntities - Starting...')

  // Get the authenticated user session.
  const session = await auth()
  if (!session || !session.user) {
    // If session not available, unauthorized error with metadata for audit.
    throw new EntityAuthError('Unauthorized access', undefined, {
      timestamp: Date.now(),
      hasSession: !!session,
      hasUser: !!session?.user,
      operation: 'getEntities'
    });
  }

  // Use userRole from the session (roles are consistent with SSOT model).
  const userRole = assertKnownUserRole(session.user.role)
  return getEntitiesForRole({ userRole, limit, startAfter, filters })
});

/**
 * Paginated, filtered query for confidential entities. Results only accessible to admin, superadmin, confidential.
 * Uses DB-level filter 'isConfidential' + optional status filter.
 */
export interface GetConfidentialEntitiesParams {
  page: number
  limit: number
  sort: string
  filter: string
  startAfter?: string
}

export interface GetConfidentialEntitiesResult {
  entities: SerializedEntity[]
  lastVisible: string | null
  totalPages: number
  totalEntities: number
}

export const getConfidentialEntities = cache(async (
  params: GetConfidentialEntitiesParams,
): Promise<GetConfidentialEntitiesResult> => {
  try {
    logger.info('Services: getConfidentialEntities - Starting...', { ...params })

    // Must be authenticated and have a valid user session.
    const session = await auth()
    if (!session || !session.user) {
      throw new EntityAuthError('Unauthorized access', undefined, {
        timestamp: Date.now(),
        hasSession: !!session,
        hasUser: !!session?.user,
        operation: 'getConfidentialEntities',
      })
    }

    // Only roles with special powers can access confidential records.
    const userRole = assertKnownUserRole(session.user.role)
    const userId = session.user.id

    // Deny access to other roles: a security fail-safe.
    if (!hasConfidentialAccess(userRole)) {
      throw new EntityPermissionError(
        'Access denied. Only admin, superadmin or confidential users can fetch confidential entities.',
        undefined,
        {
          timestamp: Date.now(),
          userRole,
          requiredRoles: [
            UserRolesArray.admin as UserRolesArray,
            UserRolesArray.superadmin as UserRolesArray,
            UserRolesArray.confidential as UserRolesArray
          ],
          operation: 'getConfidentialEntities',
        },
      )
    }

    const { limit, sort, filter, page } = params

    // Build filters - always require isConfidential=true; optionally add status.
    const dbFilters: Array<{ field: string; operator: string; value: unknown }> = [
      { field: 'isConfidential', operator: '=', value: true },
    ]

    if (filter) {
      dbFilters.push({ field: 'status', operator: '=', value: filter })
    }

    // Parse sort string for DB order (expects 'field:direction')
    const [sortField, sortDirection] = sort.split(':')

    // Count total confidential entities for pagination UI.
    const countResult = await db().countDocs('entities', dbFilters)
    const totalEntities = countResult.success ? (countResult.data || 0) : 0
    const totalPages = Math.ceil(totalEntities / limit)

    // Query the relevant page of entities.
    const result = await db().queryDocs({
      collection: 'entities',
      filters: dbFilters,
      orderBy: [{ field: sortField, direction: sortDirection as 'asc' | 'desc' }],
      pagination: { limit, offset: (page - 1) * limit },
    })

    // If the DB query failed or returned nothing, escalate as query error.
    if (!result.success || !result.data) {
      throw new EntityQueryError(
        'Failed to execute confidential entities query',
        result.error || new Error('Unknown error'),
        {
          timestamp: Date.now(),
          userRole,
          operation: 'confidential_query_execution',
        },
      )
    }

    // Reuse moderation filter: no blocked entities for this user.
    const blockedEntityIds = await getUserBlockedEntityIds(userId)
    const mapped = result.data.map((doc) => mapDbDocumentToSerializedEntity(doc))
    const entities = filterEntitiesForDiscovery(mapped, {
      userRole,
      userId,
      blockedEntityIds,
    })

    // Compute the next cursor for pagination.
    const lastVisible = entities.length > 0 ? entities[entities.length - 1].id : null

    logger.info('Services: getConfidentialEntities - Results:', {
      entitiesCount: entities.length,
      totalEntities,
      totalPages,
      lastVisible,
    })

    return {
      entities,
      lastVisible,
      totalPages,
      totalEntities,
    }
  } catch (error) {
    // Log error with context.
    logRingError(error, 'Services: getConfidentialEntities - Error')

    if (
      error instanceof EntityAuthError ||
      error instanceof EntityPermissionError ||
      error instanceof EntityQueryError ||
      error instanceof EntityDatabaseError
    ) {
      throw error
    }

    throw new EntityQueryError(
      'Unknown error occurred while fetching confidential entities',
      error instanceof Error ? error : new Error(String(error)),
      {
        timestamp: Date.now(),
        operation: 'getConfidentialEntities',
      },
    )
  }
});

/**
 * Batch fetch entities by multiple ids, ensuring only accessible entities are returned.
 * Role filtering is applied to each entity returned.
 * Uses React 19 cache() for dedupe.
 *
 * // TODO: If running on the server, could use Next.js 16's dynamic functions (not required as cache() wraps logic).
 * 
 * @param entityIds - Array of ids to retrieve.
 * @returns Array of authorized, mapped entities.
 */
export const getEntitiesByIds = cache(async (
  entityIds: string[],
): Promise<SerializedEntity[]> => {
  try {
    // STUB: Defensive null session check, forbidden for unauthenticated fetches.
    const session = await auth();
    if (!session || !session.user) {
      throw new EntityAuthError('Unauthorized access', undefined, {
        timestamp: Date.now(),
        hasSession: !!session,
        hasUser: !!session?.user,
        operation: 'getEntitiesByIds'
      });
    }
    const role = assertKnownUserRole(session.user.role);

    logger.info('Services: getEntitiesByIds - Starting batch fetch...', { entityIds: entityIds.length, userRole: role })

    if (!entityIds || entityIds.length === 0) {
      // Short-circuit: nothing to fetch.
      return [];
    }

    // Limit batch size (backend DBs often have a max 'IN' clause length). Firestore soft limit: 10/100/IN. RDBMS: ~1000-2000 typically.
    const maxBatchSize = 100;
    if (entityIds.length > maxBatchSize) {
      logger.warn(`Services: getEntitiesByIds - Batch size ${entityIds.length} exceeds maximum ${maxBatchSize}, truncating`);
      entityIds = entityIds.slice(0, maxBatchSize);
    }

    let documents: SerializedEntity[] = []
    try {
      // Simple 'IN' query for listed ids (efficient in RDBMS if indices are configured).
      const result = await db().queryDocs({
        collection: 'entities',
        filters: [{ field: 'id', operator: 'in', value: entityIds }],
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

      // Map DB rows to API-ready entity format.
      documents = result.data.map((doc) => mapDbDocumentToSerializedEntity(doc))

    } catch (error) {
      // Query error wrap for easy Sentry/bugsnag reporting.
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

    // Step 3: For each entity, filter with canViewEntity (enforces role & per-entity security).
    const entities: SerializedEntity[] = []

    documents.forEach((entity) => {
      if (canViewEntity(entity, { userRole: role })) {
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
