// DatabaseService + React 19 cache() — shared list filters with getOpportunitiesForRole.

import { cache } from 'react'
import { SerializedOpportunity } from '@/features/opportunities/types'
import { mapDbDocumentToSerializedOpportunity } from '@/features/opportunities/lib/opportunity-db-mapper'
import { UserRolesArray, assertKnownUserRole, InvalidUserRoleError } from '@/features/auth/user-role'
import { auth } from '@/auth'
import { getMcpActor } from '@/lib/auth/mcp-actor-context'
import { getMainCurrencySymbol } from '@/lib/ring-config-core'
import { db } from '@/lib/database'
import { logger } from '@/lib/logger'
import { OpportunityAuthError, OpportunityPermissionError, logRingError } from '@/lib/errors'
import { getViewerHiddenOpportunityIds } from '@/features/opportunities/services/get-viewer-interactions'
import { attachOpportunityFeedFields } from '@/features/opportunities/services/attach-opportunity-feed-fields'
import { computePaginationCursor } from '@/lib/pagination/cursor-pagination'
import {
  applyOpportunityDateCursor,
  buildOpportunityListFilters,
  buildOpportunityListOrderBy,
} from '@/features/opportunities/lib/opportunity-list-query'
import type { OpportunityListQuery } from '@/features/opportunities/lib/opportunity-search-params'

export type SearchOpportunitiesParams = OpportunityListQuery & {
  userId?: string
  entityVerified?: boolean
}

export interface SearchOpportunitiesResult {
  opportunities: SerializedOpportunity[]
  totalCount: number
  lastVisible: string | null
  searchMetadata: {
    query: string
    filtersApplied: string[]
    sortBy: string
    searchTime: number
    backend: string
  }
}

export class OpportunitySearchError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message)
    this.name = 'OpportunitySearchError'
  }
}

export const searchOpportunities = cache(async (
  params: SearchOpportunitiesParams,
): Promise<SearchOpportunitiesResult> => {
  const startTime = Date.now()

  try {
    const session = await auth()
    const mcpActor = getMcpActor()

    if (!session?.user && !mcpActor) {
      throw new OpportunityAuthError('Authentication required', undefined, {
        timestamp: Date.now(),
        operation: 'searchOpportunities',
      })
    }

    const userRole = assertKnownUserRole(session?.user?.role ?? mcpActor!.role) as UserRolesArray
    const userId = session?.user?.id ?? mcpActor?.id
    const limit = params.limit || 20

    const hiddenIds = userId ? await getViewerHiddenOpportunityIds(userId) : []
    const filters = buildOpportunityListFilters({
      ...params,
      userRole,
      hiddenIds,
    })
    await applyOpportunityDateCursor(filters, params.startAfter)

    const queryResult = await db().queryDocs({
      collection: 'opportunities',
      filters,
      orderBy: buildOpportunityListOrderBy(params.sortBy, params.sortOrder),
      pagination: { limit },
    })

    let opportunities: SerializedOpportunity[] = []
    if (queryResult.success && queryResult.data) {
      const mapped = queryResult.data.map((item) => mapDbDocumentToSerializedOpportunity(item))
      opportunities = await attachOpportunityFeedFields(mapped, {
        viewerUserId: userId,
        viewerRole: session?.user?.role ?? mcpActor?.role,
      })
    }

    const { nextCursor: lastVisible } = computePaginationCursor(
      opportunities,
      limit,
      (item) => item.id,
    )

    const filtersApplied = filters.map((filter) => `${filter.field}:${filter.operator}`)
    const searchTime = Date.now() - startTime

    logger.info('Services: searchOpportunities - Search completed', {
      query: params.query,
      resultsCount: opportunities.length,
      searchTime,
    })

    return {
      opportunities,
      // Page size only — do not countDocs on every browse page.
      totalCount: opportunities.length,
      lastVisible,
      searchMetadata: {
        query: params.query || '',
        filtersApplied,
        sortBy: params.sortBy || 'relevance',
        searchTime,
        backend: 'db().queryDocs()',
      },
    }
  } catch (error) {
    logRingError(error, 'Services: searchOpportunities - Search failed')

    if (
      error instanceof OpportunityAuthError ||
      error instanceof OpportunityPermissionError ||
      error instanceof InvalidUserRoleError
    ) {
      throw error
    }

    throw new OpportunitySearchError('Failed to execute opportunity search', {
      params,
      error: error instanceof Error ? error.message : String(error),
      timestamp: Date.now(),
    })
  }
})

export const searchOpportunitiesByQuery = cache(async (
  query: string,
  options: Omit<SearchOpportunitiesParams, 'query'> = {},
): Promise<SearchOpportunitiesResult> => {
  return searchOpportunities({ ...options, query })
})

export const searchOpportunitiesByLocation = cache(async (
  location: string,
  options: Omit<SearchOpportunitiesParams, 'location'> = {},
): Promise<SearchOpportunitiesResult> => {
  return searchOpportunities({ ...options, location })
})

export const searchOpportunitiesByBudget = cache(async (
  minBudget?: number,
  maxBudget?: number,
  currency: string = getMainCurrencySymbol(),
  options: Omit<SearchOpportunitiesParams, 'budgetMin' | 'budgetMax' | 'currency'> = {},
): Promise<SearchOpportunitiesResult> => {
  return searchOpportunities({
    ...options,
    budgetMin: minBudget,
    budgetMax: maxBudget,
    currency,
  })
})

export const searchOpportunitiesByTypeAndCategory = cache(async (
  types?: string[],
  categories?: string[],
  options: Omit<SearchOpportunitiesParams, 'types' | 'categories'> = {},
): Promise<SearchOpportunitiesResult> => {
  return searchOpportunities({ ...options, types, categories })
})

export const getSearchSuggestions = cache(async (limit: number = 10): Promise<string[]> => {
  return [
    'software development',
    'marketing',
    'consulting',
    'design',
    'data analysis',
    'project management',
    'content creation',
    'business development',
    'research',
    'training',
  ].slice(0, limit)
})

export const advancedSearchOpportunities = cache(async (
  criteria: {
    text?: string
    types?: string[]
    categories?: string[]
    location?: string
    budgetRange?: { min?: number; max?: number; currency?: string }
    priority?: 'urgent' | 'normal' | 'low' | 'all' | 'any'
    deadline?: 'today' | 'week' | 'month' | 'any'
    sortBy?: 'relevance' | 'dateCreated' | 'dateUpdated' | 'budget' | 'deadline' | 'location'
    sortOrder?: 'asc' | 'desc'
    limit?: number
  },
): Promise<SearchOpportunitiesResult> => {
  return searchOpportunities({
    query: criteria.text,
    types: criteria.types,
    categories: criteria.categories,
    location: criteria.location,
    budgetMin: criteria.budgetRange?.min,
    budgetMax: criteria.budgetRange?.max,
    currency: criteria.budgetRange?.currency,
    priority: criteria.priority,
    deadline: criteria.deadline,
    sortBy: criteria.sortBy,
    sortOrder: criteria.sortOrder,
    limit: criteria.limit,
  })
})
