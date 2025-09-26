// Client-only opportunity search implementation
// This avoids importing server-side modules that cause webpack issues

import type { OpportunityType, OpportunityVisibility, OpportunityPriority } from '@/features/opportunities/types'

export interface SearchOpportunitiesParams {
  query?: string
  types?: string[]
  categories?: string[]
  location?: string
  budgetMin?: number
  budgetMax?: number
  currency?: string
  priority?: 'urgent' | 'normal' | 'low' | 'all' | 'any'
  deadline?: 'today' | 'week' | 'month' | 'any'
  entityVerified?: boolean
  hasDeadline?: boolean
  limit?: number
  sortBy?: 'relevance' | 'dateCreated' | 'dateUpdated' | 'budget' | 'deadline' | 'location'
  sortOrder?: 'asc' | 'desc'
  userRole?: string
  userId?: string
}

export interface Attachment {
  url: string
  name: string
}

export interface SerializedOpportunity {
  id: string
  type: OpportunityType
  title: string
  isConfidential: boolean
  briefDescription: string
  fullDescription?: string
  createdBy: string
  organizationId: string
  dateCreated: string
  dateUpdated: string
  expirationDate: string
  applicationDeadline?: string
  status: 'active' | 'closed' | 'expired'
  category: string
  tags: string[]
  location: string
  budget?: {
    min?: number
    max: number
    currency?: string
  }
  requiredSkills: string[]
  requiredDocuments: string[]
  attachments: Attachment[]
  visibility: OpportunityVisibility
  contactInfo: {
    linkedEntity: string
    contactAccount: string
  }
  applicantCount: number
  maxApplicants?: number
  priority?: OpportunityPriority
  isPrivate?: boolean
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

// Client-side search function that makes API calls instead of direct database access
export async function searchOpportunities(params: SearchOpportunitiesParams): Promise<SearchOpportunitiesResult> {
  const startTime = Date.now()

  try {
    // Make API call to the search endpoint
    const response = await fetch('/api/opportunities/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()

    return {
      ...result,
      searchMetadata: {
        ...result.searchMetadata,
        searchTime: Date.now() - startTime,
        backend: 'client-api'
      }
    }
  } catch (error) {
    console.error('Client search failed:', error)

    // Return empty result on error
    return {
      opportunities: [],
      totalCount: 0,
      lastVisible: null,
      searchMetadata: {
        query: params.query || '',
        filtersApplied: ['error'],
        sortBy: params.sortBy || 'relevance',
        searchTime: Date.now() - startTime,
        backend: 'client-api-error'
      }
    }
  }
}

// Convenience functions
export async function searchOpportunitiesByQuery(
  query: string,
  options: Omit<SearchOpportunitiesParams, 'query'> = {}
): Promise<SearchOpportunitiesResult> {
  return searchOpportunities({ ...options, query })
}

export async function searchOpportunitiesByLocation(
  location: string,
  radiusKm: number = 50,
  options: Omit<SearchOpportunitiesParams, 'location' | 'locationRadius'> = {}
): Promise<SearchOpportunitiesResult> {
  return searchOpportunities({
    ...options,
    location
  })
}

export async function searchOpportunitiesByBudget(
  minBudget?: number,
  maxBudget?: number,
  currency: string = 'USD',
  options: Omit<SearchOpportunitiesParams, 'budgetMin' | 'budgetMax' | 'currency'> = {}
): Promise<SearchOpportunitiesResult> {
  return searchOpportunities({
    ...options,
    budgetMin: minBudget,
    budgetMax: maxBudget,
    currency
  })
}

export async function searchOpportunitiesByTypeAndCategory(
  types?: string[],
  categories?: string[],
  options: Omit<SearchOpportunitiesParams, 'types' | 'categories'> = {}
): Promise<SearchOpportunitiesResult> {
  return searchOpportunities({
    ...options,
    types,
    categories
  })
}

export async function advancedSearchOpportunities(criteria: {
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
}): Promise<SearchOpportunitiesResult> {
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
}
