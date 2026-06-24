/**
 * Get Confidential Opportunities Service
 *
 * Ring-native: DatabaseService + React 19 cache()
 * Session-based access control (confidential/admin/superadmin)
 * READ operation - cached for performance
 */

import { cache } from 'react'
import { auth } from '@/auth'
import { SerializedOpportunity } from '@/features/opportunities/types'
import {
  mapDbDocumentToSerializedOpportunity,
} from '@/features/opportunities/lib/opportunity-db-mapper'
import { UserRole, assertKnownUserRole, hasConfidentialAccess } from '@/features/auth/user-role'
import {
  OpportunityAuthError,
  OpportunityPermissionError,
  logRingError,
} from '@/lib/errors'
import { db } from '@/lib/database'
import { logger } from '@/lib/logger'

export interface GetConfidentialOpportunitiesParams {
  page: number
  limit: number
  sort: string
  filter: string
  startAfter?: string
}

export interface GetConfidentialOpportunitiesResult {
  opportunities: SerializedOpportunity[]
  lastVisible: string | null
  totalPages: number
  totalOpportunities: number
}

export const getConfidentialOpportunities = cache(async (
  params: GetConfidentialOpportunitiesParams,
): Promise<GetConfidentialOpportunitiesResult> => {
  try {
    logger.info('Services: getConfidentialOpportunities - Starting...', { ...params })

    const session = await auth()
    if (!session?.user?.id) {
      throw new OpportunityAuthError('Unauthorized access', undefined, {
        timestamp: Date.now(),
        hasSession: !!session,
        hasUser: !!session?.user,
        operation: 'getConfidentialOpportunities',
      })
    }

    const userRole = assertKnownUserRole(session.user.role)

    if (!hasConfidentialAccess(userRole)) {
      throw new OpportunityPermissionError(
        'Access denied. Only admin, superadmin or confidential users can fetch confidential opportunities.',
        undefined,
        {
          timestamp: Date.now(),
          userRole,
          requiredRoles: [UserRole.admin, UserRole.superadmin, UserRole.confidential],
          operation: 'getConfidentialOpportunities',
        },
      )
    }

    const { limit, startAfter, sort, filter, page } = params

    const filters: Array<{ field: string; operator: string; value: unknown }> = [
      { field: 'isConfidential', operator: '=', value: true },
    ]

    if (filter) {
      filters.push({ field: 'status', operator: '=', value: filter })
    }

    const [sortField, sortDirection] = sort.split(':')

    const countResult = await db().countDocs('opportunities', filters)
    const totalOpportunities = countResult.success ? (countResult.data ?? 0) : 0
    const totalPages = Math.ceil(totalOpportunities / limit)

    if (startAfter) {
      logger.info(`Services: getConfidentialOpportunities - Paginating after opportunity ID: ${startAfter}`)
      try {
        const startAfterResult = await db().findDocById('opportunities', startAfter)
        if (!startAfterResult.success || !startAfterResult.data) {
          logger.warn(`Services: getConfidentialOpportunities - Start-after document ${startAfter} not found`)
        }
      } catch (error) {
        logger.warn(`Services: getConfidentialOpportunities - Start-after document ${startAfter} error:`, error)
      }
    }

    const queryResult = await db().queryDocs({
      collection: 'opportunities',
      filters,
      orderBy: [{ field: sortField, direction: sortDirection as 'asc' | 'desc' }],
      pagination: { limit, offset: (page - 1) * limit },
    })

    const opportunities: SerializedOpportunity[] = []
    if (queryResult.success && queryResult.data) {
      for (const item of queryResult.data) {
        opportunities.push(mapDbDocumentToSerializedOpportunity(item))
      }
    }

    const lastVisible = opportunities.length > 0
      ? opportunities[opportunities.length - 1].id
      : null

    logger.info('Services: getConfidentialOpportunities - Results:', {
      opportunitiesCount: opportunities.length,
      totalOpportunities,
      totalPages,
      lastVisible,
    })

    return {
      opportunities,
      lastVisible,
      totalPages,
      totalOpportunities,
    }
  } catch (error) {
    logRingError(error, 'Services: getConfidentialOpportunities - Error')
    if (
      error instanceof OpportunityAuthError ||
      error instanceof OpportunityPermissionError
    ) {
      throw error
    }
    throw error instanceof Error
      ? error
      : new Error('Unknown error occurred while fetching confidential opportunities')
  }
})
