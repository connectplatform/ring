// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { Entity } from '@/features/entities/types'
import { UserRole } from '@/features/auth/types'
import { getServerAuthSession } from '@/auth'
import { QuerySnapshot } from 'firebase-admin/firestore'
import { EntityAuthError, EntityPermissionError, EntityQueryError, EntityDatabaseError, logRingError } from '@/lib/errors'
import { 
  getCachedDocument,
  getCachedCollectionAdvanced, 
  getCachedDocumentBatch 
} from '@/lib/services/firebase-service-manager'

import { cache } from 'react';
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector';
import { getCachedEntities } from '@/lib/build-cache/static-data-cache';

/**
 * Fetch a paginated list of entities based on user role.
 * 
 * This function performs the following steps:
 * 1. Authenticates the user and retrieves their session information.
 * 2. Accesses Firestore and initializes the entities collection with the entity converter.
 * 3. Builds a query based on the user's role and applies appropriate filters.
 * 4. Implements pagination using the 'limit' and 'startAfter' parameters.
 * 5. Executes the query and processes the results.
 * 6. Maps the document snapshots to Entity objects, including their IDs.
 * 7. Determines the ID of the last visible entity for future pagination.
 * 
 * User steps:
 * 1. User requests a list of entities (e.g., from a client-side component).
 * 2. The function authenticates the user and checks their role.
 * 3. Based on the user's role, the function fetches the appropriate entities.
 * 4. The function returns the entities and pagination information to the user.
 * 
 * @param {number} limit - The maximum number of entities to fetch per page. Defaults to 20.
 * @param {string} [startAfter] - The ID of the last entity from the previous page for pagination. Optional.
 * @returns {Promise<{ entities: Entity[]; lastVisible: string | null }>} A promise that resolves to an object containing the fetched entities and the ID of the last visible entity for pagination.
 * @throws {EntityAuthError} If the user is not authenticated
 * @throws {EntityDatabaseError} If there's an error accessing the database
 * @throws {EntityQueryError} If there's an error executing the query
 */
export async function getEntitiesForRole(
  params: { userRole: UserRole; limit?: number; startAfter?: string }
): Promise<{ entities: Entity[]; lastVisible: string | null }> {
  const phase = getCurrentPhase();
  const { userRole, limit = 20, startAfter } = params
  try {
    console.log('Services: getEntitiesForRole - Starting...', { userRole, limit, startAfter })

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

    // 🚀 BUILD-TIME OPTIMIZATION: Use cached data during static generation
    if (shouldUseMockData() || (shouldUseCache() && phase.isBuildTime)) {
      console.log(`[Service Optimization] Using ${phase.strategy} data for get-entities`);
      
      try {
        // Return cached data based on operation type
        const entities = await getCachedEntities({ limit: Math.min(limit, 50), isPublic: true });
        const result = entities.slice(0, limit);
        return { entities: result, lastVisible: null };
      } catch (cacheError) {
        console.warn('[Service Optimization] Cache fallback failed, using live data:', cacheError);
        // Continue to live data below
      }
    }

    // Step 2: Build optimized query configuration based on user role
    const queryConfig: any = {
      limit,
      orderBy: [{ field: 'dateAdded', direction: 'desc' }]
    };

    // Apply role-based filtering for non-admin users
    // Visitors see only public. Subscribers see public + subscriber. Members see public + subscriber + member.
    if (userRole === UserRole.VISITOR) {
      queryConfig.where = [{ field: 'visibility', operator: 'in', value: ['public'] }];
    } else if (userRole === UserRole.SUBSCRIBER) {
      queryConfig.where = [{ field: 'visibility', operator: 'in', value: ['public', 'subscriber'] }];
    } else if (userRole === UserRole.MEMBER) {
      queryConfig.where = [{ field: 'visibility', operator: 'in', value: ['public', 'subscriber', 'member'] }];
    }
    // ADMIN and CONFIDENTIAL users see all entities (no filter applied)

    // Apply pagination if provided
    if (startAfter) {
      try {
        const startAfterDoc = await getCachedDocument('entities', startAfter);
        if (startAfterDoc && startAfterDoc.exists) {
          queryConfig.startAfter = startAfterDoc;
        }
      } catch (error) {
        throw new EntityQueryError(
          'Failed to apply pagination',
          error instanceof Error ? error : new Error(String(error)),
          {
            timestamp: Date.now(),
            userRole,
            startAfter,
            operation: 'pagination'
          }
        );
      }
    }

    // Step 3: Execute optimized query
    let snapshot: QuerySnapshot;
    try {
      snapshot = await getCachedCollectionAdvanced('entities', queryConfig);
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
      );
    }

    // Step 4: Map document snapshots to Entity objects
    const entities = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    })) as Entity[]

    // Note: Role-based filtering is now handled by the query configuration above,
    // eliminating the need for additional in-memory filtering

    // Step 5: Get the ID of the last visible document for pagination
    const lastVisible = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : null

    console.log('Services: getEntitiesForRole - Total entities fetched:', entities.length)

    return { entities, lastVisible }
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
}

// Convenience wrapper for contexts where dynamic session access is allowed (not inside caches)
export async function getEntities(
  limit: number = 20,
  startAfter?: string
): Promise<{ entities: Entity[]; lastVisible: string | null }> {
  console.log('Services: getEntities - Starting...')
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    throw new EntityAuthError('Unauthorized access', undefined, {
      timestamp: Date.now(),
      hasSession: !!session,
      hasUser: !!session?.user,
      operation: 'getEntities'
    });
  }
  const userRole = session.user.role as UserRole
  return getEntitiesForRole({ userRole, limit, startAfter })
}

/**
 * Fetch all confidential entities.
 * 
 * This function performs the following steps:
 * 1. Authenticates the user and retrieves their session information.
 * 2. Validates the user's role and permissions.
 * 3. Accesses Firestore and initializes the entities collection with the entity converter.
 * 4. Builds and executes a query for confidential entities.
 * 5. Maps and returns the resulting confidential entities.
 * 
 * User steps:
 * 1. User requests confidential entities (e.g., from an admin panel).
 * 2. The function authenticates the user and checks their role.
 * 3. Based on the user's role, the function fetches confidential entities.
 * 4. The function returns the confidential entities to the user.
 * 
 * @returns {Promise<Entity[]>} A promise that resolves to an array of confidential entities.
 * @throws {EntityAuthError} If the user is not authenticated
 * @throws {EntityPermissionError} If the user lacks sufficient permissions
 * @throws {EntityDatabaseError} If there's an error accessing the database
 * @throws {EntityQueryError} If there's an error executing the query
 */
export async function getConfidentialEntities(): Promise<Entity[]> {
  try {
    console.log('Services: getConfidentialEntities - Starting...')

    // Step 1: Authenticate and get user session
    const session = await getServerAuthSession()
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

    console.log(`Services: getConfidentialEntities - User authenticated with role ${userRole}`)

    // Step 3: Build and execute optimized query for confidential entities
    let snapshot: QuerySnapshot;
    try {
      const queryConfig = {
        where: [{ field: 'isConfidential', operator: '==' as const, value: true }],
        orderBy: [{ field: 'dateAdded', direction: 'desc' as const }]
      };
      
      snapshot = await getCachedCollectionAdvanced('entities', queryConfig);
    } catch (error) {
      throw new EntityQueryError(
        'Failed to execute confidential entities query',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          userRole,
          operation: 'confidential_query_execution'
        }
      );
    }

    // Step 5: Map and return resulting confidential entities
    const confidentialEntities = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    })) as Entity[]

    console.log('Services: getConfidentialEntities - Total confidential entities fetched:', confidentialEntities.length)

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
}

/**
 * Batch fetch multiple entities by their IDs with role-based filtering.
 * 
 * This function is optimized for scenarios where you need to retrieve multiple
 * specific entities at once (e.g., 20+ entities by ID) with automatic caching
 * and request deduplication.
 * 
 * User steps:
 * 1. User provides an array of entity IDs to fetch
 * 2. Function authenticates the user and validates their role
 * 3. Uses getCachedDocumentBatch for optimized batch retrieval
 * 4. Applies role-based filtering to the results
 * 5. Returns only the entities the user has permission to view
 * 
 * @param entityIds - Array of entity IDs to fetch
 * @param userRole - The role of the requesting user
 * @returns Promise<Entity[]> - Array of entities the user can access
 * @throws {EntityAuthError} If the user is not authenticated
 * @throws {EntityPermissionError} If the user lacks sufficient permissions
 * @throws {EntityQueryError} If there's an error executing the batch query
 */
export async function getEntitiesByIds(
  entityIds: string[],
  userRole?: UserRole
): Promise<Entity[]> {
  try {
    console.log('Services: getEntitiesByIds - Starting batch fetch...', { entityIds: entityIds.length, userRole })

    // If no userRole provided, get from session
    let role = userRole;
    if (!role) {
      const session = await getServerAuthSession();
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
      console.warn(`Services: getEntitiesByIds - Batch size ${entityIds.length} exceeds maximum ${maxBatchSize}, truncating`);
      entityIds = entityIds.slice(0, maxBatchSize);
    }

    // Step 1: Build batch request array
    const batchRequests = entityIds.map(id => ({
      collection: 'entities',
      docId: id
    }));

    // Step 2: Execute optimized batch retrieval
    let documents;
    try {
      documents = await getCachedDocumentBatch(batchRequests);
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
      );
    }

    // Step 3: Process documents and apply role-based filtering
    const entities: Entity[] = [];
    
    documents.forEach((doc, index) => {
      if (doc && doc.exists) {
        const entityData = doc.data() as Entity;
        const entity = { ...entityData, id: doc.id };
        
        // Apply role-based visibility filtering
        const canView = canUserViewEntity(entity, role);
        if (canView) {
          entities.push(entity);
        }
      }
    });

    console.log('Services: getEntitiesByIds - Batch fetch completed:', {
      requested: entityIds.length,
      found: documents.filter(d => d && d.exists).length,
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
}

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

