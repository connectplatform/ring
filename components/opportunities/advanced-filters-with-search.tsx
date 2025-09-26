'use client'

import { useState, useCallback, useTransition } from 'react'
import AdvancedFilters from './advanced-filters'

// Define FilterState interface locally
interface FilterState {
  search: string
  types: string[]
  categories: string[]
  location: string
  budgetMin: string
  budgetMax: string
  currency: string
  priority: string
  deadline: string
  entityVerified: boolean | null
  hasDeadline: boolean | null
}
import { searchOpportunities, SearchOpportunitiesParams, SearchOpportunitiesResult } from '@/lib/client-search'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

interface AdvancedFiltersWithSearchProps {
  onSearchStart?: () => void
  onSearchEnd?: () => void
  defaultFilters?: Partial<FilterState>
  className?: string
}

const defaultFilterState: FilterState = {
  search: '',
  types: [],
  categories: [],
  location: '',
  budgetMin: '',
  budgetMax: '',
  currency: 'USD',
  priority: 'all',
  deadline: 'any',
  entityVerified: null,
  hasDeadline: null
}

export function AdvancedFiltersWithSearch({
  onSearchStart,
  onSearchEnd,
  defaultFilters = {},
  className = ''
}: AdvancedFiltersWithSearchProps) {
  const t = useTranslations('modules.opportunities')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [filters, setFilters] = useState<FilterState>({
    ...defaultFilterState,
    ...defaultFilters
  })

  const performSearch = useCallback(async (searchFilters: FilterState) => {
    onSearchStart?.()

    try {
      // Update URL with filter parameters
      const url = new URL(window.location.href)

      if (searchFilters.search) {
        url.searchParams.set('q', searchFilters.search)
      } else {
        url.searchParams.delete('q')
      }

      if (searchFilters.types.length > 0) {
        url.searchParams.set('types', searchFilters.types.join(','))
      } else {
        url.searchParams.delete('types')
      }

      if (searchFilters.categories.length > 0) {
        url.searchParams.set('categories', searchFilters.categories.join(','))
      } else {
        url.searchParams.delete('categories')
      }

      if (searchFilters.location) {
        url.searchParams.set('location', searchFilters.location)
      } else {
        url.searchParams.delete('location')
      }

      if (searchFilters.budgetMin) {
        url.searchParams.set('budgetMin', searchFilters.budgetMin)
      } else {
        url.searchParams.delete('budgetMin')
      }

      if (searchFilters.budgetMax) {
        url.searchParams.set('budgetMax', searchFilters.budgetMax)
      } else {
        url.searchParams.delete('budgetMax')
      }

      if (searchFilters.priority && searchFilters.priority !== 'all') {
        url.searchParams.set('priority', searchFilters.priority)
      } else {
        url.searchParams.delete('priority')
      }

      if (searchFilters.deadline && searchFilters.deadline !== 'any') {
        url.searchParams.set('deadline', searchFilters.deadline)
      } else {
        url.searchParams.delete('deadline')
      }

      if (searchFilters.entityVerified !== null) {
        url.searchParams.set('entityVerified', searchFilters.entityVerified.toString())
      } else {
        url.searchParams.delete('entityVerified')
      }

      if (searchFilters.hasDeadline !== null) {
        url.searchParams.set('hasDeadline', searchFilters.hasDeadline.toString())
      } else {
        url.searchParams.delete('hasDeadline')
      }

      router.push(url.toString())

    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      onSearchEnd?.()
    }
  }, [router, onSearchStart, onSearchEnd])

  const handleFiltersChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters)

    // Auto-search when filters change (debounced)
    if (hasActiveFilters(newFilters)) {
      performSearch(newFilters)
    }
  }, [performSearch])

  const handleClearFilters = useCallback(() => {
    const clearedFilters = { ...defaultFilterState }
    setFilters(clearedFilters)

    // Clear filter parameters from URL
    const url = new URL(window.location.href)
    url.searchParams.delete('q')
    url.searchParams.delete('types')
    url.searchParams.delete('categories')
    url.searchParams.delete('location')
    url.searchParams.delete('budgetMin')
    url.searchParams.delete('budgetMax')
    url.searchParams.delete('priority')
    url.searchParams.delete('deadline')
    url.searchParams.delete('entityVerified')
    url.searchParams.delete('hasDeadline')
    router.push(url.toString())
  }, [router])

  const hasActiveFilters = (filterState: FilterState): boolean => {
    return !!(
      filterState.search ||
      filterState.types.length > 0 ||
      filterState.categories.length > 0 ||
      filterState.location ||
      filterState.budgetMin ||
      filterState.budgetMax ||
      (filterState.priority && filterState.priority !== 'all') ||
      (filterState.deadline && filterState.deadline !== 'any') ||
      filterState.entityVerified !== null ||
      filterState.hasDeadline !== null
    )
  }

  return (
    <div className={className}>
      <AdvancedFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClearFilters={handleClearFilters}
        resultCount={isPending ? undefined : undefined} // TODO: Pass actual result count when available
      />

      {isPending && (
        <div className="mt-4 flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          <span className="ml-2 text-sm text-muted-foreground">
            {t('searching') || 'Searching...'}
          </span>
        </div>
      )}
    </div>
  )
}

// Helper function to convert search results to URL parameters for navigation
export function searchResultsToURLParams(results: SearchOpportunitiesResult): URLSearchParams {
  const params = new URLSearchParams()

  if (results.opportunities.length > 0) {
    params.set('searchResults', 'true')
    params.set('totalCount', results.totalCount.toString())
    params.set('searchTime', results.searchMetadata.searchTime.toString())
  }

  return params
}

// Helper function to convert FilterState to URL parameters
export function filtersToURLParams(filters: FilterState): URLSearchParams {
  const params = new URLSearchParams()

  if (filters.search) params.set('q', filters.search)
  if (filters.types.length > 0) params.set('types', filters.types.join(','))
  if (filters.categories.length > 0) params.set('categories', filters.categories.join(','))
  if (filters.location) params.set('location', filters.location)
  if (filters.budgetMin) params.set('budgetMin', filters.budgetMin)
  if (filters.budgetMax) params.set('budgetMax', filters.budgetMax)
  if (filters.currency) params.set('currency', filters.currency)
  if (filters.priority && filters.priority !== 'all') params.set('priority', filters.priority)
  if (filters.deadline && filters.deadline !== 'any') params.set('deadline', filters.deadline)
  if (filters.entityVerified !== null) params.set('entityVerified', filters.entityVerified.toString())
  if (filters.hasDeadline !== null) params.set('hasDeadline', filters.hasDeadline.toString())

  return params
}

// Helper function to parse URL parameters back to FilterState
export function urlParamsToFilters(searchParams: URLSearchParams): Partial<FilterState> {
  const filters: Partial<FilterState> = {}

  if (searchParams.has('q')) filters.search = searchParams.get('q') || ''
  if (searchParams.has('types')) filters.types = searchParams.get('types')?.split(',') || []
  if (searchParams.has('categories')) filters.categories = searchParams.get('categories')?.split(',') || []
  if (searchParams.has('location')) filters.location = searchParams.get('location') || ''
  if (searchParams.has('budgetMin')) filters.budgetMin = searchParams.get('budgetMin') || ''
  if (searchParams.has('budgetMax')) filters.budgetMax = searchParams.get('budgetMax') || ''
  if (searchParams.has('currency')) filters.currency = searchParams.get('currency') || 'USD'
  if (searchParams.has('priority')) filters.priority = searchParams.get('priority') as any
  if (searchParams.has('deadline')) filters.deadline = searchParams.get('deadline') as any
  if (searchParams.has('entityVerified')) filters.entityVerified = searchParams.get('entityVerified') === 'true'
  if (searchParams.has('hasDeadline')) filters.hasDeadline = searchParams.get('hasDeadline') === 'true'

  return filters
}
