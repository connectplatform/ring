/**
 * Get User Opportunities Service
 *
 * React 19 cache() wrapper for user-specific opportunity queries
 * PostgreSQL via DatabaseService abstraction
 */

import { cache } from 'react'
import { OpportunitySubmenuCounts, SerializedOpportunity } from '@/features/opportunities/types'
import { auth } from '@/auth'
import { OpportunityAuthError, OpportunityQueryError, logRingError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { db } from '@/lib/database'
import { computePaginationCursor } from '@/lib/pagination/cursor-pagination'
import {
  type MyOpportunitiesView,
  type MyOpportunitiesCounts,
  computeMyOpportunitiesCounts,
  matchesMyOpportunitiesView,
} from '@/features/opportunities/lib/lifecycle-status'
import {
  mapDbDocumentToSerializedOpportunity,
} from '@/features/opportunities/lib/opportunity-db-mapper'

const MY_OPPORTUNITIES_FETCH_CAP = 200
const MY_OPPORTUNITIES_PAGE_SIZE = 50

function statusFiltersForView(
  view: MyOpportunitiesView,
): Array<{ field: string; operator: string; value: unknown }> {
  switch (view) {
    case 'archived':
      return [{ field: 'status', operator: '==', value: 'archived' }]
    case 'pending':
      return [{ field: 'status', operator: '==', value: 'pending' }]
    case 'active':
      return [{ field: 'status', operator: '==', value: 'active' }]
    case 'drafts':
      return [{ field: 'status', operator: 'in', value: ['draft', 'closed', 'expired'] }]
    case 'all':
    default:
      return [
        {
          field: 'status',
          operator: 'in',
          value: ['draft', 'pending', 'active', 'closed', 'expired'],
        },
      ]
  }
}

const parseCountResult = (value: unknown): number => {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return 0
}

/**
 * Fetches opportunities created by a user with real dateCreated cursor pagination.
 */
export const getUserCreatedOpportunities = cache(async (
  userId: string,
  limit: number = MY_OPPORTUNITIES_FETCH_CAP,
  startAfter?: string,
  view: MyOpportunitiesView = 'all',
): Promise<{ opportunities: SerializedOpportunity[]; lastVisible: string | null }> => {
  try {
    logger.info('Services: getUserCreatedOpportunities', { userId, limit, startAfter, view })

    const filters: Array<{ field: string; operator: string; value: unknown }> = [
      { field: 'createdBy', operator: '=', value: userId },
      ...statusFiltersForView(view),
    ]

    if (startAfter) {
      const cursorDoc = await db().findDocById('opportunities', startAfter)
      if (cursorDoc.success && cursorDoc.data) {
        const cursorDate =
          (cursorDoc.data as { dateCreated?: string; date_created?: string }).dateCreated ??
          (cursorDoc.data as { date_created?: string }).date_created
        if (cursorDate) {
          filters.push({ field: 'dateCreated', operator: '<', value: cursorDate })
        }
      }
    }

    const queryResult = await db().queryDocs({
      collection: 'opportunities',
      filters,
      orderBy: [{ field: 'dateCreated', direction: 'desc' as const }],
      pagination: { limit },
    })

    const opportunities: SerializedOpportunity[] = []
    if (queryResult.success && queryResult.data) {
      for (const item of queryResult.data) {
        opportunities.push(mapDbDocumentToSerializedOpportunity(item))
      }
    }

    const { nextCursor: lastVisible } = computePaginationCursor(
      opportunities,
      limit,
      (item) => item.id,
    )

    return { opportunities, lastVisible }
  } catch (error) {
    logRingError(error, 'getUserCreatedOpportunities: Error')
    throw new OpportunityQueryError(
      'Failed to fetch user opportunities',
      error instanceof Error ? error : new Error(String(error)),
      { timestamp: Date.now(), userId, operation: 'getUserCreatedOpportunities' },
    )
  }
})

const getMyOpportunitySubmenuCounts = cache(async (userId: string): Promise<OpportunitySubmenuCounts> => {
  const postedFilter = { field: 'createdBy', operator: '=', value: userId }
  const expiredFilter = { field: 'expirationDate', operator: '<=', value: new Date() }

  const [postedCountResult, expiredCountResult, created, archivedSample] = await Promise.all([
    db().countDocs('opportunities', [postedFilter]),
    db().countDocs('opportunities', [postedFilter, expiredFilter]),
    getUserCreatedOpportunities(userId, MY_OPPORTUNITIES_FETCH_CAP, undefined, 'all'),
    getUserCreatedOpportunities(userId, MY_OPPORTUNITIES_FETCH_CAP, undefined, 'archived'),
  ])

  const posted = postedCountResult.success ? parseCountResult(postedCountResult.data) : 0
  const expired = expiredCountResult.success ? parseCountResult(expiredCountResult.data) : 0
  const lifecycle = computeMyOpportunitiesCounts([
    ...created.opportunities,
    ...archivedSample.opportunities,
  ])

  return {
    all: lifecycle.all,
    saved: 0,
    applied: 0,
    posted,
    drafts: lifecycle.drafts,
    expired,
    pending: lifecycle.pending,
    active: lifecycle.active,
    archived: lifecycle.archived,
  }
})

/**
 * Fetches the current user's created opportunities filtered by lifecycle view.
 */
export const getMyOpportunities = cache(async (
  view: MyOpportunitiesView = 'all',
  limit: number = MY_OPPORTUNITIES_PAGE_SIZE,
  startAfter?: string,
): Promise<{
  opportunities: SerializedOpportunity[]
  lastVisible: string | null
  counts: OpportunitySubmenuCounts
  lifecycleCounts: MyOpportunitiesCounts
}> => {
  const session = await auth()

  if (!session?.user) {
    throw new OpportunityAuthError('Authentication required', undefined, {
      timestamp: Date.now(),
      operation: 'getMyOpportunities',
    })
  }

  const userId = session.user.id

  try {
    const [page, counts] = await Promise.all([
      getUserCreatedOpportunities(userId, limit, startAfter, view),
      getMyOpportunitySubmenuCounts(userId),
    ])

    const lifecycleCounts: MyOpportunitiesCounts = {
      all: counts.all,
      drafts: counts.drafts,
      pending: counts.pending,
      active: counts.active,
      archived: counts.archived,
    }

    return {
      opportunities: page.opportunities.filter((opp) =>
        matchesMyOpportunitiesView(opp.status, view),
      ),
      lastVisible: page.lastVisible,
      counts,
      lifecycleCounts,
    }
  } catch (error) {
    logRingError(error, 'getMyOpportunities: Error')
    throw error
  }
})

/** @deprecated Applied opportunities tracking not yet implemented */
export const getUserAppliedOpportunities = cache(async () => ({
  opportunities: [] as SerializedOpportunity[],
  lastVisible: null as string | null,
}))
