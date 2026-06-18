/**
 * Get Opportunity By ID Service
 * 
 * Ring-native: DatabaseService + React 19 cache()
 * READ operation cached for performance
 */

import { cache } from 'react'
import { Opportunity, SerializedOpportunity } from '@/features/opportunities/types'
import { UserRole } from '@/features/auth/types'
import {
  assertKnownUserRole,
} from '@/features/auth/user-role'
import { canViewOpportunity } from '@/features/opportunities/lib/opportunity-visibility-filter'
import { auth } from '@/auth'
import { db } from '@/lib/database'
import {
  mapDbDocumentToOpportunity,
  mapDbRowToSerializedOpportunity,
} from '@/features/opportunities/lib/opportunity-db-mapper'

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

export const getOpportunityById = cache(async (id: string): Promise<Opportunity | null> => {
  try {
    const session = await auth()
    
    if (!session || !session.user) {
      throw new OpportunityAccessDeniedError('Authentication required')
    }

    const userRole = assertKnownUserRole(session.user.role)

    const result = await db().findDocById<Record<string, unknown>>('opportunities', id)

    if (!result.success || !result.data) {
      return null
    }

    const opportunity = mapDbDocumentToOpportunity(result.data)

    if (!canViewOpportunity(opportunity, { userRole, userId: session.user.id })) {
      throw new OpportunityAccessDeniedError(
        'Insufficient role to view this opportunity',
      )
    }

    return opportunity
  } catch (error) {
    if (error instanceof OpportunityNotFoundError || error instanceof OpportunityAccessDeniedError) {
      throw error
    }
    throw new Error('Opportunity retrieval failed')
  }
})

export const getSerializedOpportunityById = cache(async (id: string): Promise<SerializedOpportunity | null> => {
  try {
    const opportunity = await getOpportunityById(id)
    
    if (!opportunity) {
      return null
    }

    return mapDbRowToSerializedOpportunity(
      id,
      opportunity as unknown as Record<string, unknown>,
    )
  } catch (error) {
    if (error instanceof OpportunityNotFoundError || error instanceof OpportunityAccessDeniedError) {
      throw error
    }
    throw new Error('Opportunity serialization failed')
  }
})

export const getOpportunity = cache(async (opportunityId: string): Promise<Opportunity | null> => {
  try {
    const result = await db().findDocById<Record<string, unknown>>('opportunities', opportunityId)

    if (result.success && result.data) {
      const opportunity = mapDbDocumentToOpportunity(result.data)
      if (opportunity.isConfidential) {
        return null
      }
      return opportunity
    }

    return null
  } catch (error) {
    return null
  }
})
