/**
 * Entity Retrieval Service
 * 
 * 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
 * - Centralized service manager with React 19 cache() for request deduplication
 * - Build-time phase detection and intelligent caching strategies
 * - Auth.js v5 authentication with role-based access control
 * - Serialization support for client components
 * - Unified entity retrieval functions
 */

import { Entity, SerializedEntity } from '@/features/entities/types'
import { cache } from 'react'
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector'
import { getCachedDocument as getCachedStaticDocument, getCachedCollection, getCachedEntities } from '@/lib/build-cache/static-data-cache'
import { getCachedDocumentTyped, getCachedCollectionTyped } from '@/lib/services/firebase-service-manager'
import { auth } from '@/auth'
import { UserRole } from '@/features/auth/types'

/**
 * Fetches an entity by its ID from Firestore, enforcing role-based access control.
 * 
 * This function performs the following steps:
 * 1. Authenticates the user and retrieves their session using Auth.js v5.
 * 2. Checks the user's role for access control.
 * 3. Queries Firestore for the entity with the given ID.
 * 4. Enforces confidentiality rules based on the user's role and the entity's status.
 * 5. Returns the entity if found and the user has permission, or null if not found.
 * 
 * User steps:
 * 1. User requests to view an entity (e.g., by navigating to an entity page).
 * 2. The application calls this function with the entity ID.
 * 3. If the user is authenticated and has the right permissions, they see the entity details.
 * 4. If the user lacks permissions or the entity doesn't exist, appropriate error handling occurs.
 * 
 * @param {string} id - The unique identifier of the entity to fetch.
 * @returns {Promise<Entity | null>} A promise that resolves to the Entity object if found, or null if not found.
 * @throws {Error} If the user is not authenticated or lacks the necessary permissions.
 * 
 * Note: Confidential entities can only be accessed by users with CONFIDENTIAL or ADMIN roles.
 *       Non-confidential entities can be accessed by all authenticated users.
 */
/**
 * Custom error classes for entity operations
 */
export class EntityNotFoundError extends Error {
  constructor(id: string) {
    super(`Entity not found`)
    this.name = 'EntityNotFoundError'
  }
}

export class EntityAccessDeniedError extends Error {
  constructor(reason: string) {
    super(`Access denied: ${reason}`)
    this.name = 'EntityAccessDeniedError'
  }
}

/**
 * Fetches an entity by its ID with Auth.js v5 authentication and role-based access control.
 * 
 * Features:
 * - Auth.js v5 session handling with tiered access control per Platform Philosophy
 * - Build-time optimization with graceful auth handling
 * - Confidential entity access control (CONFIDENTIAL/ADMIN only)
 * - React 19 cache() for request deduplication
 * 
 * @param id - The unique identifier of the entity to fetch
 * @returns Promise that resolves to Entity object or null if not found
 * @throws EntityNotFoundError if entity doesn't exist
 * @throws EntityAccessDeniedError if user lacks permissions
 */
export const getEntityById = cache(async (id: string): Promise<Entity | null> => {
  try {
    const phase = getCurrentPhase()
    
    // Step 1: Handle authentication with build-time graceful fallback
    const session = await auth()
    
    // During build time, allow unauthenticated access for public entities only
    if (phase.isBuildTime && !session) {
      console.log('[Build Optimization] Build-time access - using cached data')
      
      try {
        const cachedEntities = await getCachedEntities()
        const cachedEntity = cachedEntities.find(e => e.id === id)
        
        // Only return public entities during build
        if (cachedEntity && !cachedEntity.isConfidential) {
          return cachedEntity as Entity
        }
        return null
      } catch (cacheError) {
        console.warn('[Build Optimization] Cache miss during build')
        return null
      }
    }

    // Runtime authentication required
    if (!phase.isBuildTime && (!session || !session.user)) {
      throw new EntityAccessDeniedError('Authentication required')
    }

    const userRole = (session?.user?.role as UserRole) || UserRole.VISITOR

    // Step 2: Fetch entity using appropriate strategy
    let entity: Entity | null = null
    
    if (shouldUseMockData() || (shouldUseCache() && phase.isBuildTime)) {
      // Build-time: Use cached data
      const cachedEntities = await getCachedEntities()
      entity = cachedEntities.find(e => e.id === id) as Entity || null
    } else {
      // Runtime: Use Firebase
      entity = await getCachedDocumentTyped<Entity>('entities', id)
    }

    if (!entity) {
      return null
    }

    // Step 3: Apply Platform Philosophy access control
    // Confidential entities: CONFIDENTIAL or ADMIN only
    if (entity.isConfidential && userRole !== UserRole.CONFIDENTIAL && userRole !== UserRole.ADMIN) {
      throw new EntityAccessDeniedError('Confidential entity access requires CONFIDENTIAL or ADMIN role')
    }

    return entity
  } catch (error) {
    if (error instanceof EntityNotFoundError || error instanceof EntityAccessDeniedError) {
      throw error
    }
    throw new Error('Entity retrieval failed')
  }
})

/**
 * Fetches an entity by its ID and returns it in serialized format for client components.
 * Uses the centralized entity-serializer for consistent timestamp conversion.
 * 
 * @param id - The unique identifier of the entity to fetch
 * @returns Promise that resolves to SerializedEntity object or null if not found
 * @throws EntityNotFoundError if entity doesn't exist
 * @throws EntityAccessDeniedError if user lacks permissions
 */
export const getSerializedEntityById = cache(async (id: string): Promise<SerializedEntity | null> => {
  try {
    const entity = await getEntityById(id)
    
    if (!entity) {
      return null
    }

    // Use the centralized entity serializer
    const { serializeEntity } = await import('@/lib/converters/entity-serializer')
    return serializeEntity(entity)
  } catch (error) {
    if (error instanceof EntityNotFoundError || error instanceof EntityAccessDeniedError) {
      throw error
    }
    throw new Error('Entity serialization failed')
  }
})

/**
 * Simple entity retrieval without authentication (for public entities only)
 * Use getEntityById for authenticated access with role-based permissions
 * 
 * @param entityId - The unique identifier of the entity to fetch
 * @returns Promise that resolves to Entity object or null if not found
 */
export const getEntity = cache(async (entityId: string): Promise<Entity | null> => {
  try {
    const entity = await getCachedDocumentTyped<Entity>('entities', entityId)
    
    // Only return public entities for unauthenticated access
    if (entity && entity.isConfidential) {
      return null
    }
    
    return entity
  } catch (error) {
    return null
  }
})

/**
 * Get entities created by a specific user with proper authentication
 * 
 * @param userId - The user ID to fetch entities for
 * @returns Promise that resolves to array of Entity objects
 */
export const getUserEntities = cache(async (userId: string): Promise<Entity[]> => {
  try {
    const session = await auth()
    if (!session?.user) {
      return []
    }

    // Users can only see their own entities or admins can see all
    const userRole = session.user.role as UserRole
    const canViewAll = userRole === UserRole.ADMIN
    const isOwnEntities = session.user.id === userId

    if (!canViewAll && !isOwnEntities) {
      throw new EntityAccessDeniedError('Can only view own entities')
    }

    const result = await getCachedCollectionTyped<Entity>('entities', {
      filters: [{ field: 'createdBy', operator: '==', value: userId }],
      orderBy: { field: 'createdAt', direction: 'desc' }
    })
    
    return result.items
  } catch (error) {
    return []
  }
})

/**
 * Example usage:
 * 
 * // Authenticated access with tiered role-based permissions (Platform Philosophy)
 * const entity = await getEntityById('entity-id')
 * 
 * // Serialized for client components
 * const serializedEntity = await getSerializedEntityById('entity-id')
 * 
 * // Public entities only (no authentication required)
 * const publicEntity = await getEntity('entity-id')
 * 
 * // User's own entities
 * const userEntities = await getUserEntities('user-id')
 * 
 * // Error handling
 * try {
 *   const entity = await getEntityById('confidential-entity-id')
 * } catch (error) {
 *   if (error instanceof EntityAccessDeniedError) {
 *     // Handle access denied - redirect to upgrade
 *   }
 * }
 */

