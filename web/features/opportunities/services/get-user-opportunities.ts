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
  isMyOpportunitiesInteractionView,
  matchesMyOpportunitiesView,
} from '@/features/opportunities/lib/lifecycle-status'
import { mapDbDocumentToSerializedOpportunity } from '@/features/opportunities/lib/opportunity-db-mapper'
import { attachOpportunityFeedFields } from '@/features/opportunities/services/attach-opportunity-feed-fields'

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
    case 'saved':
    case 'applied':
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

function rowTargetId(row: Record<string, unknown>): string {
  return String(row.targetId || row.target_id || '').trim()
}

async function applyCreatedDateCursor(
  filters: Array<{ field: string; operator: string; value: unknown }>,
  startAfter?: string,
): Promise<void> {
  if (!startAfter) return
  const cursorDoc = await db().findDocById('opportunities', startAfter)
  if (!cursorDoc.success || !cursorDoc.data) return
  const cursorDate =
    (cursorDoc.data as { dateCreated?: string; date_created?: string }).dateCreated ??
    (cursorDoc.data as { date_created?: string }).date_created
  if (cursorDate) {
    filters.push({ field: 'dateCreated', operator: '<', value: cursorDate })
  }
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
    await applyCreatedDateCursor(filters, startAfter)

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

export const getUserSavedOpportunities = cache(async (
  userId: string,
  limit: number = MY_OPPORTUNITIES_PAGE_SIZE,
  startAfter?: string,
): Promise<{ opportunities: SerializedOpportunity[]; lastVisible: string | null }> => {
  try {
    const uciFilters: Array<{ field: string; operator: string; value: unknown }> = [
      { field: 'userId', operator: '==', value: userId },
      { field: 'targetType', operator: '==', value: 'opportunity' },
      { field: 'action', operator: '==', value: 'save' },
    ]

    const uciResult = await db().queryDocs<Record<string, unknown>>({
      collection: 'user_content_interactions',
      filters: uciFilters,
      orderBy: [{ field: 'createdAt', direction: 'desc' as const }],
      pagination: { limit: MY_OPPORTUNITIES_FETCH_CAP },
    })

    const savedIds = [
      ...new Set(
        (uciResult.success && uciResult.data ? uciResult.data : [])
          .map(rowTargetId)
          .filter(Boolean),
      ),
    ]
    if (savedIds.length === 0) {
      return { opportunities: [], lastVisible: null }
    }

    const startIndex = startAfter ? savedIds.indexOf(startAfter) + 1 : 0
    const pageIds = (startIndex >= 0 ? savedIds.slice(startIndex) : savedIds).slice(0, limit)
    if (pageIds.length === 0) {
      return { opportunities: [], lastVisible: null }
    }

    const queryResult = await db().queryDocs({
      collection: 'opportunities',
      filters: [{ field: 'id', operator: 'in', value: pageIds }],
    })

    const byId = new Map<string, SerializedOpportunity>()
    if (queryResult.success && queryResult.data) {
      for (const item of queryResult.data) {
        const mapped = mapDbDocumentToSerializedOpportunity(item)
        byId.set(mapped.id, mapped)
      }
    }

    const opportunities = pageIds
      .map((id) => byId.get(id))
      .filter((row): row is SerializedOpportunity => Boolean(row))

    const reachedEnd = startIndex + pageIds.length >= savedIds.length
    const lastVisible = reachedEnd || opportunities.length === 0
      ? null
      : opportunities[opportunities.length - 1]?.id ?? null

    return { opportunities, lastVisible }
  } catch (error) {
    logRingError(error, 'getUserSavedOpportunities: Error')
    throw new OpportunityQueryError(
      'Failed to fetch saved opportunities',
      error instanceof Error ? error : new Error(String(error)),
      { timestamp: Date.now(), userId, operation: 'getUserSavedOpportunities' },
    )
  }
})

export const getUserAppliedOpportunities = cache(async (
  userId: string,
  limit: number = MY_OPPORTUNITIES_PAGE_SIZE,
  startAfter?: string,
): Promise<{ opportunities: SerializedOpportunity[]; lastVisible: string | null }> => {
  try {
    const filters: Array<{ field: string; operator: string; value: unknown }> = [
      { field: 'applicants', operator: 'jsonb-contains', value: [userId] },
    ]
    await applyCreatedDateCursor(filters, startAfter)

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
    logRingError(error, 'getUserAppliedOpportunities: Error')
    throw new OpportunityQueryError(
      'Failed to fetch applied opportunities',
      error instanceof Error ? error : new Error(String(error)),
      { timestamp: Date.now(), userId, operation: 'getUserAppliedOpportunities' },
    )
  }
})

const getMyOpportunitySubmenuCounts = cache(async (userId: string): Promise<OpportunitySubmenuCounts> => {
  const postedFilter = { field: 'createdBy', operator: '=', value: userId }
  const expiredFilter = { field: 'expirationDate', operator: '<=', value: new Date() }
  const savedFilters = [
    { field: 'userId', operator: '==', value: userId },
    { field: 'targetType', operator: '==', value: 'opportunity' },
    { field: 'action', operator: '==', value: 'save' },
  ]
  const appliedFilters = [{ field: 'applicants', operator: 'jsonb-contains', value: [userId] }]

  const [
    postedCountResult,
    expiredCountResult,
    savedCountResult,
    appliedCountResult,
    created,
    archivedSample,
  ] = await Promise.all([
    db().countDocs('opportunities', [postedFilter]),
    db().countDocs('opportunities', [postedFilter, expiredFilter]),
    db().countDocs('user_content_interactions', savedFilters),
    db().countDocs('opportunities', appliedFilters),
    getUserCreatedOpportunities(userId, MY_OPPORTUNITIES_FETCH_CAP, undefined, 'all'),
    getUserCreatedOpportunities(userId, MY_OPPORTUNITIES_FETCH_CAP, undefined, 'archived'),
  ])

  const posted = postedCountResult.success ? parseCountResult(postedCountResult.data) : 0
  const expired = expiredCountResult.success ? parseCountResult(expiredCountResult.data) : 0
  const saved = savedCountResult.success ? parseCountResult(savedCountResult.data) : 0
  const applied = appliedCountResult.success ? parseCountResult(appliedCountResult.data) : 0
  const lifecycle = computeMyOpportunitiesCounts([
    ...created.opportunities,
    ...archivedSample.opportunities,
  ])

  return {
    all: lifecycle.all,
    saved,
    applied,
    posted,
    drafts: lifecycle.drafts,
    expired,
    pending: lifecycle.pending,
    active: lifecycle.active,
    archived: lifecycle.archived,
  }
})

/**
 * Fetches the current user's created / saved / applied opportunities by lifecycle view.
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
    const pagePromise =
      view === 'saved'
        ? getUserSavedOpportunities(userId, limit, startAfter)
        : view === 'applied'
          ? getUserAppliedOpportunities(userId, limit, startAfter)
          : getUserCreatedOpportunities(userId, limit, startAfter, view)

    const [page, counts] = await Promise.all([
      pagePromise,
      getMyOpportunitySubmenuCounts(userId),
    ])

    const lifecycleCounts: MyOpportunitiesCounts = {
      all: counts.all,
      drafts: counts.drafts,
      pending: counts.pending ?? 0,
      active: counts.active ?? 0,
      archived: counts.archived ?? 0,
    }

    const rows = isMyOpportunitiesInteractionView(view)
      ? page.opportunities
      : page.opportunities.filter((opp) => matchesMyOpportunitiesView(opp.status, view))

    const opportunities = await attachOpportunityFeedFields(rows, {
      viewerUserId: userId,
      viewerRole: session.user.role,
    })

    return {
      opportunities,
      lastVisible: page.lastVisible,
      counts,
      lifecycleCounts,
    }
  } catch (error) {
    logRingError(error, 'getMyOpportunities: Error')
    throw error
  }
})
