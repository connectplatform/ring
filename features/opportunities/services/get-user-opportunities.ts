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

const parseCountResult = (value: unknown): number => {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return 0
}

/**
 * Fetches all opportunities created by a user (capped for dashboard filtering).
 */
export const getUserCreatedOpportunities = cache(async (
  userId: string,
  limit: number = MY_OPPORTUNITIES_FETCH_CAP,
  startAfter?: string,
): Promise<{ opportunities: SerializedOpportunity[]; lastVisible: string | null }> => {
  try {
    logger.info('Services: getUserCreatedOpportunities', { userId, limit, startAfter })

    const dbQuery = {
      collection: 'opportunities',
      filters: [{ field: 'createdBy', operator: '=', value: userId }],
      orderBy: [{ field: 'dateCreated', direction: 'desc' as const }],
      pagination: {
        limit,
        offset: startAfter ? 1 : 0,
      },
    }

    const queryResult = await db().queryDocs(dbQuery)

    const opportunities: SerializedOpportunity[] = []
    if (queryResult.success && queryResult.data) {
      for (const item of queryResult.data) {
        opportunities.push(mapDbDocumentToSerializedOpportunity(item))
      }
    }

    const lastVisible =
      opportunities.length > 0 ? opportunities[opportunities.length - 1].id : null

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

  const [postedCountResult, expiredCountResult, created] = await Promise.all([
    db().countDocs('opportunities', [postedFilter]),
    db().countDocs('opportunities', [postedFilter, expiredFilter]),
    getUserCreatedOpportunities(userId, MY_OPPORTUNITIES_FETCH_CAP),
  ])

  const posted = postedCountResult.success ? parseCountResult(postedCountResult.data) : 0
  const expired = expiredCountResult.success ? parseCountResult(expiredCountResult.data) : 0
  const lifecycle = computeMyOpportunitiesCounts(created.opportunities)

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
  limit: number = 50,
  _startAfter?: string,
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
    const created = await getUserCreatedOpportunities(userId, MY_OPPORTUNITIES_FETCH_CAP)
    const lifecycleCounts = computeMyOpportunitiesCounts(created.opportunities)
    const filtered = created.opportunities.filter((opp) =>
      matchesMyOpportunitiesView(opp.status, view),
    )
    const opportunities = filtered.slice(0, limit)
    const counts = await getMyOpportunitySubmenuCounts(userId)

    return {
      opportunities,
      lastVisible: opportunities.length > 0 ? opportunities[opportunities.length - 1].id : null,
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
