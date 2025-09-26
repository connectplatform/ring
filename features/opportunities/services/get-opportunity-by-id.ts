/**
 * Opportunity Retrieval Service
 * 
 * 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
 * - Centralized service manager with React 19 cache() for request deduplication
 * - Build-time phase detection and intelligent caching strategies
 * - Auth.js v5 authentication with role-based access control
 * - Serialization support for client components
 * - Unified opportunity retrieval functions
 */

import { Opportunity, SerializedOpportunity } from '@/features/opportunities/types'
import { cache } from 'react'
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector'
import { getCachedDocument as getCachedStaticDocument, getCachedOpportunities } from '@/lib/build-cache/static-data-cache'
import { db } from '@/lib/database/DatabaseService'
import { auth } from '@/auth'
import { UserRole } from '@/features/auth/types'

/**
 * Custom error classes for opportunity operations
 */
export class OpportunityNotFoundError extends Error {
  constructor(id: string) {
    super(`Opportunity not found`)
    this.name = 'OpportunityNotFoundError'
  }
}

export class OpportunityAccessDeniedError extends Error {
  constructor(reason: string) {
    super(`Access denied: ${reason}`)
    this.name = 'OpportunityAccessDeniedError'
  }
}

/**
 * Fetches an opportunity by its ID with Auth.js v5 authentication and role-based access control.
 * 
 * Features:
 * - Auth.js v5 session handling with tiered access control per Platform Philosophy
 * - Build-time optimization with graceful auth handling
 * - Confidential opportunity access control (CONFIDENTIAL/ADMIN only)
 * - React 19 cache() for request deduplication
 * 
 * @param id - The unique identifier of the opportunity to fetch
 * @returns Promise that resolves to Opportunity object or null if not found
 * @throws OpportunityNotFoundError if opportunity doesn't exist
 * @throws OpportunityAccessDeniedError if user lacks permissions
 */
export const getOpportunityById = cache(async (id: string): Promise<Opportunity | null> => {
  try {
    const phase = getCurrentPhase()
    
    // Step 1: Handle authentication with build-time graceful fallback
    const session = await auth()
    
    // During build time, allow unauthenticated access for public opportunities only
    if (phase.isBuildTime && !session) {
      console.log('[Build Optimization] Build-time access - using cached data')
      
      try {
        const cachedOpportunities = await getCachedOpportunities()
        const cachedOpportunity = cachedOpportunities.find(o => o.id === id)
        
        // Only return public opportunities during build
        if (cachedOpportunity && !cachedOpportunity.isConfidential) {
          return cachedOpportunity as Opportunity
        }
        return null
      } catch (cacheError) {
        console.warn('[Build Optimization] Cache miss during build')
        return null
      }
    }

    // Runtime authentication required
    if (!phase.isBuildTime && (!session || !session.user)) {
      throw new OpportunityAccessDeniedError('Authentication required')
    }

    const userRole = (session?.user?.role as UserRole) || UserRole.VISITOR

    // Step 2: Fetch opportunity using appropriate strategy
    let opportunity: Opportunity | null = null
    
    if (shouldUseMockData() || (shouldUseCache() && phase.isBuildTime)) {
      // Build-time: Use cached data
      const cachedOpportunities = await getCachedOpportunities()
      opportunity = cachedOpportunities.find(o => o.id === id) as Opportunity || null
    } else {
      // Runtime: Use db.command() abstraction
      const result = await db().execute('findById', {
        collection: 'opportunities',
        id: id
      });

      if (result.success && result.data) {
        opportunity = result.data.data as Opportunity;
      }
    }

    if (!opportunity) {
      return null
    }

    // Step 3: Apply Platform Philosophy access control
    // Confidential opportunities: CONFIDENTIAL or ADMIN only
    if (opportunity.isConfidential && userRole !== UserRole.CONFIDENTIAL && userRole !== UserRole.ADMIN) {
      throw new OpportunityAccessDeniedError('Confidential opportunity access requires CONFIDENTIAL or ADMIN role')
    }

    return opportunity
  } catch (error) {
    if (error instanceof OpportunityNotFoundError || error instanceof OpportunityAccessDeniedError) {
      throw error
    }
    throw new Error('Opportunity retrieval failed')
  }
})

/**
 * Fetches an opportunity by its ID and returns it in serialized format for client components.
 * 
 * @param id - The unique identifier of the opportunity to fetch
 * @returns Promise that resolves to SerializedOpportunity object or null if not found
 * @throws OpportunityNotFoundError if opportunity doesn't exist
 * @throws OpportunityAccessDeniedError if user lacks permissions
 */
export const getSerializedOpportunityById = cache(async (id: string): Promise<SerializedOpportunity | null> => {
  try {
    const opportunity = await getOpportunityById(id)
    
    if (!opportunity) {
      return null
    }

    // Use the centralized opportunity serializer
    const { serializeOpportunity } = await import('@/lib/converters/opportunity-serializer')
    return serializeOpportunity(opportunity)
  } catch (error) {
    if (error instanceof OpportunityNotFoundError || error instanceof OpportunityAccessDeniedError) {
      throw error
    }
    throw new Error('Opportunity serialization failed')
  }
})

/**
 * Simple opportunity retrieval without authentication (for public opportunities only)
 * Use getOpportunityById for authenticated access with role-based permissions
 * 
 * @param opportunityId - The unique identifier of the opportunity to fetch
 * @returns Promise that resolves to Opportunity object or null if not found
 */
export const getOpportunity = cache(async (opportunityId: string): Promise<Opportunity | null> => {
  try {
    const result = await db().execute('findById', {
      collection: 'opportunities',
      id: opportunityId
    });

    if (result.success && result.data) {
      const opportunity = result.data.data as Opportunity;
      // Only return public opportunities for unauthenticated access
      if (opportunity && opportunity.isConfidential) {
        return null
      }
      return opportunity;
    }

    return null;
  } catch (error) {
    return null
  }
})

/**
 * Example usage:
 * 
 * // Authenticated access with tiered role-based permissions (Platform Philosophy)
 * const opportunity = await getOpportunityById('opportunity-id')
 * 
 * // Serialized for client components
 * const serializedOpportunity = await getSerializedOpportunityById('opportunity-id')
 * 
 * // Public opportunities only (no authentication required)
 * const publicOpportunity = await getOpportunity('opportunity-id')
 * 
 * // Error handling
 * try {
 *   const opportunity = await getOpportunityById('confidential-opportunity-id')
 * } catch (error) {
 *   if (error instanceof OpportunityAccessDeniedError) {
 *     // Handle access denied - redirect to upgrade
 *   }
 * }
 */