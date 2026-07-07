/**
 * Get Confidential Opportunities Service
 *
 * Ring-native: DatabaseService + React 19 cache()
 * Session-based access control (confidential/admin/superadmin)
 * READ operation - cached for performance
 */

// --- Imports ---
// Using React 19's cache for server function memoization.
// TODO: Consider switching to React's experimental useCache if moving to fully Server Components.
import { cache } from 'react'
import { auth } from '@/auth'
import { SerializedOpportunity } from '@/features/opportunities/types'
import { mapDbDocumentToSerializedOpportunity } from '@/features/opportunities/lib/opportunity-db-mapper'
import { UserRolesArray, assertKnownUserRole, hasConfidentialAccess } from '@/features/auth/user-role'
import {
  OpportunityAuthError,
  OpportunityPermissionError,
  logRingError,
} from '@/lib/errors'
import { db } from '@/lib/database'
import { logger } from '@/lib/logger'

// --- Param & Result Types ---
export interface GetConfidentialOpportunitiesParams {
  page: number                     // Current page number for pagination
  limit: number                    // Number of records per page
  sort: string                     // Sorting format: "field:direction"
  filter: string                   // Status or additional filter
  startAfter?: string              // Pagination cursor (optional)
}

export interface GetConfidentialOpportunitiesResult {
  opportunities: SerializedOpportunity[] // Resulting confidential opportunities
  lastVisible: string | null            // The ID of the last item for pagination cursor
  totalPages: number                    // Total # of available pages
  totalOpportunities: number            // Total # of matching documents
}

// --- Main Service (server function, memoized by cache) ---
export const getConfidentialOpportunities = cache(async (
  params: GetConfidentialOpportunitiesParams,
): Promise<GetConfidentialOpportunitiesResult> => {
  try {
    // Log the entry and parameters for debugging/monitoring
    logger.info('Services: getConfidentialOpportunities - Starting...', { ...params })

    // --- Session/Auth Check ---

    // Await current session; user must be logged in
    const session = await auth()
    // If user is not authenticated, throw a tailored error for upstream handling
    if (!session?.user?.id) {
      throw new OpportunityAuthError('Unauthorized access', undefined, {
        timestamp: Date.now(),
        hasSession: !!session,
        hasUser: !!session?.user,
        operation: 'getConfidentialOpportunities',
      })
    }

    // --- RBAC (Role-Based Access Control) ---

    // Check that the user's role is recognized by our platform (throws if unrecognized)
    const userRole = assertKnownUserRole(session.user.role)

    // Only admin, superadmin or confidential users may see confidential opportunities
    if (!hasConfidentialAccess(userRole)) {
      throw new OpportunityPermissionError(
        'Access denied. Only admin, superadmin or confidential users can fetch confidential opportunities.',
        undefined,
        {
          timestamp: Date.now(),
          userRole,
          requiredRoles: [UserRolesArray.admin, UserRolesArray.superadmin, UserRolesArray.confidential],
          operation: 'getConfidentialOpportunities',
        },
      )
    }

    // --- Prepare Query Parameters from client request ---
    const { limit, startAfter, sort, filter, page } = params

    // Build base filters: must always be confidential
    const filters: Array<{ field: string; operator: string; value: unknown }> = [
      { field: 'isConfidential', operator: '=', value: true },
    ]

    // Add status filter if one was specified by user (e.g. "filled", "open", etc.)
    if (filter) {
      filters.push({ field: 'status', operator: '=', value: filter })
    }

    // Parse requested sort "field:direction" e.g. "createdAt:desc"
    const [sortField, sortDirection] = sort.split(':')

    // --- Count Total Matching Documents for Pagination ---
    const countResult = await db().countDocs('opportunities', filters)
    // Defensive fallback: fallback to 0 if db fails
    const totalOpportunities = countResult.success ? (countResult.data ?? 0) : 0
    const totalPages = Math.ceil(totalOpportunities / limit)

    // --- Optionally Validate startAfter Cursor (if paginating by cursor) ---
    if (startAfter) {
      logger.info(`Services: getConfidentialOpportunities - Paginating after opportunity ID: ${startAfter}`)
      try {
        // Check that the cursor actually points to a valid document
        const startAfterResult = await db().findDocById('opportunities', startAfter)
        if (!startAfterResult.success || !startAfterResult.data) {
          // Warn but continue anyway (do not hard-fail if startAfter missing)
          logger.warn(`Services: getConfidentialOpportunities - Start-after document ${startAfter} not found`)
        }
      } catch (error) {
        // STUB: Optionally, error handling could abort instead of warning if startAfter required for pagination
        logger.warn(`Services: getConfidentialOpportunities - Start-after document ${startAfter} error:`, error)
      }
    }

    // --- Query Opportunities Page ---
    // TODO: If db().queryDocs supports cursor-based pagination natively, prefer startAfter/cursor over offset for larger datasets for better performance.
    const queryResult = await db().queryDocs({
      collection: 'opportunities',
      filters,
      orderBy: [{ field: sortField, direction: sortDirection as 'asc' | 'desc' }],
      pagination: { limit, offset: (page - 1) * limit },
    })

    // --- Map/projection of Raw Documents to API shape ---
    const opportunities: SerializedOpportunity[] = []
    if (queryResult.success && queryResult.data) {
      for (const item of queryResult.data) {
        // STUB: Assuming mapDbDocumentToSerializedOpportunity is up-to-date to serialize all required fields.
        opportunities.push(mapDbDocumentToSerializedOpportunity(item))
      }
    }

    // --- Compute Pagination Metadata ---
    const lastVisible = opportunities.length > 0
      ? opportunities[opportunities.length - 1].id // Use the last returned doc as next-page cursor
      : null

    // Log results summary, but DO NOT log confidential records themselves.
    logger.info('Services: getConfidentialOpportunities - Results:', {
      opportunitiesCount: opportunities.length,
      totalOpportunities,
      totalPages,
      lastVisible,
    })

    // --- Return the Final Result Object ---
    return {
      opportunities,
      lastVisible,
      totalPages,
      totalOpportunities,
    }
  } catch (error) {
    // Log error; categorize RBAC & Auth errors explicitly, pass through as-is for error overlays in Next.js
    logRingError(error, 'Services: getConfidentialOpportunities - Error')
    if (
      error instanceof OpportunityAuthError ||
      error instanceof OpportunityPermissionError
    ) {
      throw error
    }
    // Fallback: wrap unknown errors as generic error
    throw error instanceof Error
      ? error
      : new Error('Unknown error occurred while fetching confidential opportunities')
  }
})
