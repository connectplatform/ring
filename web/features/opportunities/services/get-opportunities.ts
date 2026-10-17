/**
 * Get Opportunities Service
 *
 * Ring-native: DatabaseService + React 19 cache()
 * Shared filters live in opportunity-list-query.ts (also used by search).
 */

import { cache } from 'react'
import { SerializedOpportunity } from '@/features/opportunities/types'
import { mapDbDocumentToSerializedOpportunity } from '@/features/opportunities/lib/opportunity-db-mapper'
import { UserRolesArray, assertKnownUserRole, resolveSessionUserRole } from '@/features/auth/user-role'
import { auth } from '@/auth'
import {
  OpportunityPermissionError,
  OpportunityQueryError,
  OpportunityDatabaseError,
  logRingError,
} from '@/lib/errors'
import { logger } from '@/lib/logger'
import { db } from '@/lib/database'
import { computePaginationCursor } from '@/lib/pagination/cursor-pagination'
import { getViewerHiddenOpportunityIds } from '@/features/opportunities/services/get-viewer-interactions'
import { attachOpportunityFeedFields } from '@/features/opportunities/services/attach-opportunity-feed-fields'
import {
  applyOpportunityDateCursor,
  buildOpportunityListFilters,
  buildOpportunityListOrderBy,
} from '@/features/opportunities/lib/opportunity-list-query'
import type { OpportunityListQuery } from '@/features/opportunities/lib/opportunity-search-params'

export type GetOpportunitiesForRoleParams = OpportunityListQuery & {
  userRole: UserRolesArray
  viewerUserId?: string
  viewerRole?: string | null
}

export const getOpportunitiesForRole = cache(async (
  params: GetOpportunitiesForRoleParams,
): Promise<{ opportunities: SerializedOpportunity[]; lastVisible: string | null }> => {
  const { userRole, limit = 20, startAfter, viewerUserId, viewerRole } = params

  try {
    const resolvedRole =
      userRole === UserRolesArray.visitor
        ? UserRolesArray.visitor
        : assertKnownUserRole(userRole)

    const hiddenIds = viewerUserId ? await getViewerHiddenOpportunityIds(viewerUserId) : []
    const filters = buildOpportunityListFilters({
      ...params,
      userRole: resolvedRole,
      hiddenIds,
    })
    await applyOpportunityDateCursor(filters, startAfter)

    const queryResult = await db().queryDocs({
      collection: 'opportunities',
      filters,
      orderBy: buildOpportunityListOrderBy(params.sortBy, params.sortOrder),
      pagination: { limit },
    })

    const mapped: SerializedOpportunity[] = []
    if (queryResult.success && queryResult.data) {
      for (const item of queryResult.data) {
        mapped.push(mapDbDocumentToSerializedOpportunity(item))
      }
    }

    const visibleMapped =
      resolvedRole === UserRolesArray.visitor
        ? mapped.filter(
            (item) =>
              item.isConfidential !== true &&
              (item.visibility === 'public' ||
                item.visibility === undefined ||
                item.visibility === null),
          )
        : mapped

    const opportunities = await attachOpportunityFeedFields(visibleMapped, {
      viewerUserId,
      viewerRole: viewerRole ?? resolvedRole,
    })

    const { nextCursor: lastVisible } = computePaginationCursor(
      opportunities,
      limit,
      (item) => item.id,
    )

    logger.info('Services: getOpportunitiesForRole - fetched', {
      count: opportunities.length,
      lastVisible,
    })

    return { opportunities, lastVisible }
  } catch (error) {
    logRingError(error, 'Services: getOpportunitiesForRole - Error')

    if (
      error instanceof OpportunityPermissionError ||
      error instanceof OpportunityQueryError ||
      error instanceof OpportunityDatabaseError
    ) {
      throw error
    }

    throw new OpportunityQueryError(
      'Unknown error occurred while fetching opportunities',
      error instanceof Error ? error : new Error(String(error)),
      {
        timestamp: Date.now(),
        operation: 'getOpportunitiesForRole',
      },
    )
  }
})

export const getOpportunities = cache(async (
  limit: number = 20,
  startAfter?: string,
): Promise<{ opportunities: SerializedOpportunity[]; lastVisible: string | null }> => {
  const session = await auth()

  const userRole = session?.user
    ? (resolveSessionUserRole(session.user.role) as UserRolesArray)
    : UserRolesArray.visitor

  return getOpportunitiesForRole({
    userRole,
    limit,
    startAfter,
    viewerUserId: session?.user?.id,
    viewerRole: session?.user?.role ?? UserRolesArray.visitor,
  })
})
