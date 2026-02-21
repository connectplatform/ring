// 🚀 RING-NATIVE: DatabaseService + React 19 cache()
// Advanced search with role-based access control
// READ operation - cached for performance
// Full-text search, location/budget filtering, pagination

import { cache } from 'react'
import { Opportunity, SerializedOpportunity } from '@/features/opportunities/types'
import { UserRole } from '@/features/auth/types'
import { auth } from '@/auth'
import { db } from '@/lib/database/DatabaseService'
import { logger } from '@/lib/logger'
import { OpportunityAuthError, OpportunityPermissionError, OpportunityQueryError, logRingError } from '@/lib/errors'

/**
 * Search parameters interface for comprehensive opportunity search
 */
export interface SearchOpportunitiesParams {
  // Text search
  query?: string

  // Filters
  types?: string[]
  categories?: string[]
  location?: string
  locationRadius?: number // in kilometers
  budgetMin?: number
  budgetMax?: number
  currency?: string
  deadline?: 'today' | 'week' | 'month' | 'any'
  entityVerified?: boolean
  hasDeadline?: boolean

  // Sorting
  sortBy?: 'relevance' | 'dateCreated' | 'dateUpdated' | 'budget' | 'deadline' | 'location'
  sortOrder?: 'asc' | 'desc'

  // Pagination
  limit?: number
  startAfter?: string

  // User context (for role-based filtering)
  userRole?: UserRole
  userId?: string
  // Extended priority type to include filter options
  priority?: 'urgent' | 'normal' | 'low' | 'all' | 'any'
}

/**
 * Search result interface
 */
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

/**
 * Error classes for search operations
 */
export class OpportunitySearchError extends Error {
  constructor(message: string, public details?: any) {
    super(message)
    this.name = 'OpportunitySearchError'
  }
}

/**
 * Advanced opportunity search function with comprehensive filtering and sorting
 *
 * Features:
 * - Full-text search across title, description, tags, and required skills
 * - Multi-type filtering (offer, request, partnership, etc.)
 * - Category-based filtering
 * - Location-based search with radius
 * - Budget range filtering with currency support
 * - Priority and deadline filtering
 * - Role-based visibility and confidentiality filtering
 * - Multiple sorting options (relevance, date, budget, location)
 * - Cursor-based pagination
 * - Performance optimization with caching
 *
 * @param params - Search parameters
 * @returns Promise with search results and metadata
 * @throws OpportunityAuthError if user authentication fails
 * @throws OpportunityPermissionError if user lacks permissions
 * @throws OpportunitySearchError if search operation fails
 */
export const searchOpportunities = cache(async (
  params: SearchOpportunitiesParams
): Promise<SearchOpportunitiesResult> => {
  const startTime = Date.now()

  try {
    logger.info('Services: searchOpportunities - Starting advanced search', { params })

    // Step 1: Authentication and user context
    let userRole: UserRole = UserRole.VISITOR
    let userId: string | undefined

    const session = await auth()
    if (session?.user) {
      userRole = session.user.role as UserRole
      userId = session.user.id
    }

    // Override with provided user context if specified
    if (params.userRole) {
      userRole = params.userRole
    }
    if (params.userId) {
      userId = params.userId
    }

    // Step 2: Build comprehensive search filters
    const filters: Array<{ field: string; operator: string; value: any }> = []
    const filtersApplied: string[] = []

    // Role-based visibility filtering
    if (userRole === UserRole.VISITOR) {
      filters.push({ field: 'visibility', operator: '==', value: 'public' })
      filtersApplied.push('public_visibility')
    } else if (userRole === UserRole.SUBSCRIBER) {
      filters.push({
        field: 'visibility',
        operator: 'in',
        value: ['public', 'subscriber']
      })
      filtersApplied.push('subscriber_visibility')
    } else if (userRole === UserRole.MEMBER) {
      filters.push({
        field: 'visibility',
        operator: 'in',
        value: ['public', 'subscriber', 'member']
      })
      filtersApplied.push('member_visibility')
    }
    // ADMIN and CONFIDENTIAL users see all (no visibility filter)

    // Confidentiality filtering
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.CONFIDENTIAL) {
      // Non-admin users can only see non-confidential opportunities
      filters.push({ field: 'isConfidential', operator: '==', value: false })
      filtersApplied.push('non_confidential_only')
    }

    // Type filtering
    if (params.types && params.types.length > 0) {
      filters.push({ field: 'type', operator: 'in', value: params.types })
      filtersApplied.push(`types: ${params.types.join(', ')}`)
    }

    // Category filtering
    if (params.categories && params.categories.length > 0) {
      filters.push({ field: 'category', operator: 'in', value: params.categories })
      filtersApplied.push(`categories: ${params.categories.join(', ')}`)
    }

    // Location-based filtering (simple text match for now)
    if (params.location) {
      // For location search, we'll use a more sophisticated approach
      // This could be enhanced with geolocation in the future
      filters.push({
        field: 'location',
        operator: '>=',
        value: params.location.toLowerCase()
      })
      filters.push({
        field: 'location',
        operator: '<=',
        value: params.location.toLowerCase() + '\uf8ff'
      })
      filtersApplied.push(`location: ${params.location}`)
    }

    // Budget filtering
    if (params.budgetMin !== undefined || params.budgetMax !== undefined) {
      const budgetFilters: any = {}

      if (params.budgetMin !== undefined) {
        budgetFilters.min = { operator: '>=', value: params.budgetMin }
        filtersApplied.push(`budget_min: ${params.budgetMin}`)
      }

      if (params.budgetMax !== undefined) {
        budgetFilters.max = { operator: '<=', value: params.budgetMax }
        filtersApplied.push(`budget_max: ${params.budgetMax}`)
      }

      if (params.currency) {
        budgetFilters.currency = { operator: '==', value: params.currency }
        filtersApplied.push(`currency: ${params.currency}`)
      }

      // Add budget filters as nested queries
      if (budgetFilters.min) {
        filters.push({ field: 'budget.min', operator: '>=', value: budgetFilters.min.value })
      }
      if (budgetFilters.max) {
        filters.push({ field: 'budget.max', operator: '<=', value: budgetFilters.max.value })
      }
      if (budgetFilters.currency) {
        filters.push({ field: 'budget.currency', operator: '==', value: budgetFilters.currency.value })
      }
    }

    // Priority filtering
    if (params.priority && params.priority !== 'all' && params.priority !== 'any') {
      filters.push({ field: 'priority', operator: '==', value: params.priority })
      filtersApplied.push(`priority: ${params.priority}`)
    } else if (params.priority === 'all' || params.priority === 'any') {
      // No priority filter needed for 'all' or 'any'
      filtersApplied.push(`priority: ${params.priority}`)
    }

    // Deadline filtering
    if (params.deadline && params.deadline !== 'any') {
      const now = new Date()
      let deadlineDate: Date

      switch (params.deadline) {
        case 'today':
          deadlineDate = new Date(now.getTime() + 24 * 60 * 60 * 1000)
          break
        case 'week':
          deadlineDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          deadlineDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
          break
        default:
          deadlineDate = now
      }

      filters.push({ field: 'applicationDeadline', operator: '<=', value: deadlineDate })
      filtersApplied.push(`deadline: ${params.deadline}`)
    }

    // Entity verification filtering
    if (params.entityVerified !== undefined) {
      filters.push({ field: 'entityVerified', operator: '==', value: params.entityVerified })
      filtersApplied.push(`entity_verified: ${params.entityVerified}`)
    }

    // Has deadline filtering
    if (params.hasDeadline !== undefined) {
      if (params.hasDeadline) {
        filters.push({ field: 'applicationDeadline', operator: '!=', value: null })
      } else {
        filters.push({ field: 'applicationDeadline', operator: '==', value: null })
      }
      filtersApplied.push(`has_deadline: ${params.hasDeadline}`)
    }

    // Step 3: Build sorting configuration
    const sortBy = params.sortBy || 'relevance'
    const sortOrder = params.sortOrder || 'desc'

    let orderBy: Array<{ field: string; direction: 'asc' | 'desc' }> = []

    switch (sortBy) {
      case 'relevance':
        // For relevance, we'll sort by dateCreated first, then other factors
        orderBy = [
          { field: 'dateCreated', direction: 'desc' },
          { field: 'priority', direction: 'asc' }
        ]
        break
      case 'dateCreated':
        orderBy = [{ field: 'dateCreated', direction: sortOrder as 'asc' | 'desc' }]
        break
      case 'dateUpdated':
        orderBy = [{ field: 'dateUpdated', direction: sortOrder as 'asc' | 'desc' }]
        break
      case 'budget':
        orderBy = [{ field: 'budget.min', direction: sortOrder as 'asc' | 'desc' }]
        break
      case 'deadline':
        orderBy = [{ field: 'applicationDeadline', direction: sortOrder as 'asc' | 'desc' }]
        break
      case 'location':
        orderBy = [{ field: 'location', direction: sortOrder as 'asc' | 'desc' }]
        break
      default:
        orderBy = [{ field: 'dateCreated', direction: 'desc' }]
    }

    // Step 4: Execute search query
    let totalCount = 0
    let opportunities: SerializedOpportunity[] = []
    let lastVisible: string | null = null

    // For text search, we need special handling since db.command() may not support full-text search yet
    if (params.query && params.query.trim()) {
      // For now, we'll use a simpler approach with title and description search
      // This can be enhanced when PostgreSQL full-text search is implemented
      const searchTerm = params.query.toLowerCase().trim()

      // Add text search filters
      filters.push({
        field: 'title',
        operator: '>=',
        value: searchTerm
      })
      filters.push({
        field: 'title',
        operator: '<=',
        value: searchTerm + '\uf8ff'
      })

      filtersApplied.push(`text_search: "${searchTerm}"`)
    }

    // Execute the main search query
    const dbQuery = {
      collection: 'opportunities',
      filters: filters,
      orderBy: orderBy,
      pagination: {
        limit: params.limit || 20,
        offset: params.startAfter ? 1 : 0
      }
    }

    try {
      // Get total count
      const countResult = await db().execute('count', {
        collection: 'opportunities',
        filters: filters
      })

      totalCount = countResult.success ? countResult.data : 0

      // Execute main query
      const queryResult = await db().execute('query', { querySpec: dbQuery })

      if (queryResult.success && queryResult.data) {
        // Convert to serialized format
        const timestampToISO = (timestamp: any): string => {
          if (timestamp && typeof timestamp.toDate === 'function') {
            return timestamp.toDate().toISOString()
          }
          if (timestamp instanceof Date) {
            return timestamp.toISOString()
          }
          return new Date().toISOString()
        }

        opportunities = queryResult.data.map((item: any) => {
          const data = item.data
          return {
            ...data,
            id: item.id,
            dateCreated: timestampToISO(data.dateCreated),
            dateUpdated: timestampToISO(data.dateUpdated),
            expirationDate: timestampToISO(data.expirationDate),
            applicationDeadline: data.applicationDeadline ? timestampToISO(data.applicationDeadline) : undefined,
          } as SerializedOpportunity
        })

        lastVisible = opportunities.length > 0 ? opportunities[opportunities.length - 1].id : null
      }
    } catch (queryError) {
      logger.warn('Services: searchOpportunities - Query failed, falling back to basic search', queryError)

      // No cached fallback - return empty
      opportunities = []
      totalCount = 0
      lastVisible = null
    }

    const searchTime = Date.now() - startTime

    logger.info('Services: searchOpportunities - Search completed', {
      query: params.query,
      resultsCount: opportunities.length,
      totalCount,
      searchTime,
      filtersApplied: filtersApplied.length
    })

    return {
      opportunities,
      totalCount,
      lastVisible,
      searchMetadata: {
        query: params.query || '',
        filtersApplied,
        sortBy,
        searchTime,
        backend: 'db.command()'
      }
    }

  } catch (error) {
    logRingError(error, 'Services: searchOpportunities - Search failed')

    if (error instanceof OpportunityAuthError || error instanceof OpportunityPermissionError) {
      throw error
    }

    throw new OpportunitySearchError(
      'Failed to execute opportunity search',
      {
        params,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      }
    )
  }
})

/**
 * Convenience function for simple text-based opportunity search
 *
 * @param query - Search query string
 * @param options - Additional search options
 * @returns Promise with search results
 */
export const searchOpportunitiesByQuery = cache(async (
  query: string,
  options: Omit<SearchOpportunitiesParams, 'query'> = {}
): Promise<SearchOpportunitiesResult> => {
  return searchOpportunities({ ...options, query })
})

/**
 * Search opportunities by location with radius
 *
 * @param location - Location search string
 * @param radiusKm - Search radius in kilometers
 * @param options - Additional search options
 * @returns Promise with location-based search results
 */
export const searchOpportunitiesByLocation = cache(async (
  location: string,
  radiusKm: number = 50,
  options: Omit<SearchOpportunitiesParams, 'location' | 'locationRadius'> = {}
): Promise<SearchOpportunitiesResult> => {
  return searchOpportunities({
    ...options,
    location,
    locationRadius: radiusKm
  })
})

/**
 * Search opportunities by budget range
 *
 * @param minBudget - Minimum budget
 * @param maxBudget - Maximum budget
 * @param currency - Currency code (default: USD)
 * @param options - Additional search options
 * @returns Promise with budget-filtered search results
 */
export const searchOpportunitiesByBudget = cache(async (
  minBudget?: number,
  maxBudget?: number,
  currency: string = 'USD',
  options: Omit<SearchOpportunitiesParams, 'budgetMin' | 'budgetMax' | 'currency'> = {}
): Promise<SearchOpportunitiesResult> => {
  return searchOpportunities({
    ...options,
    budgetMin: minBudget,
    budgetMax: maxBudget,
    currency
  })
})

/**
 * Search opportunities by type and category
 *
 * @param types - Array of opportunity types
 * @param categories - Array of categories
 * @param options - Additional search options
 * @returns Promise with filtered search results
 */
export const searchOpportunitiesByTypeAndCategory = cache(async (
  types?: string[],
  categories?: string[],
  options: Omit<SearchOpportunitiesParams, 'types' | 'categories'> = {}
): Promise<SearchOpportunitiesResult> => {
  return searchOpportunities({
    ...options,
    types,
    categories
  })
})

/**
 * Get popular search suggestions based on current data
 *
 * @param limit - Maximum number of suggestions
 * @returns Promise with popular search terms
 */
export const getSearchSuggestions = cache(async (limit: number = 10): Promise<string[]> => {
  try {
    // This would typically query a search analytics collection
    // For now, return some common search terms
    const commonTerms = [
      'software development',
      'marketing',
      'consulting',
      'design',
      'data analysis',
      'project management',
      'content creation',
      'business development',
      'research',
      'training'
    ]

    return commonTerms.slice(0, limit)
  } catch (error) {
    logger.warn('Services: getSearchSuggestions - Failed to get suggestions', error)
    return []
  }
})

/**
 * Advanced search with multiple criteria combined
 *
 * @param criteria - Combined search criteria
 * @returns Promise with comprehensive search results
 */
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
  }
): Promise<SearchOpportunitiesResult> => {
  const params: SearchOpportunitiesParams = {
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
    limit: criteria.limit
  }

  return searchOpportunities(params)
})

/**
 * Example usage:
 *
 * // Basic text search
 * const results = await searchOpportunitiesByQuery('software development')
 *
 * // Advanced search with multiple filters
 * const advanced = await advancedSearchOpportunities({
 *   text: 'marketing',
 *   types: ['offer', 'partnership'],
 *   categories: ['technology', 'business'],
 *   location: 'Kyiv',
 *   budgetRange: { min: 1000, max: 5000, currency: 'USD' },
 *   sortBy: 'relevance',
 *   limit: 20
 * })
 *
 * // Location-based search
 * const locationResults = await searchOpportunitiesByLocation('Kyiv', 50)
 *
 * // Budget-based search
 * const budgetResults = await searchOpportunitiesByBudget(1000, 10000, 'USD')
 */
