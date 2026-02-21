/**
 * Get Opportunity By ID Service
 * 
 * Ring-native: DatabaseService + React 19 cache()
 * READ operation cached for performance
 */

import { cache } from 'react'
import { Opportunity, SerializedOpportunity } from '@/features/opportunities/types'
import { UserRole } from '@/features/auth/types'
import { auth } from '@/auth'
import { initializeDatabase, getDatabaseService } from '@/lib/database'

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
    // Step 1: Authenticate user
    const session = await auth()
    
    if (!session || !session.user) {
      throw new OpportunityAccessDeniedError('Authentication required')
    }

    const userRole = (session?.user?.role as UserRole) || UserRole.VISITOR

    // Step 2: Fetch opportunity using DatabaseService
      await initializeDatabase()
      const db = getDatabaseService()
      const result = await db.findById('opportunities', id)

    if (!result.success || !result.data) {
      return null
    }

    const doc = result.data as any
    const opportunity = doc.data || doc as Opportunity

    // Step 3: Apply access control - Confidential: CONFIDENTIAL or ADMIN only
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
    await initializeDatabase()
    const db = getDatabaseService()
    const result = await db.findById('opportunities', opportunityId)

    if (result.success && result.data) {
      const doc = result.data as any
      const opportunity = doc.data || doc
      // Only return public opportunities for unauthenticated access
      if (opportunity && opportunity.isConfidential) {
        return null
      }
      return opportunity as Opportunity
    }

    return null
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