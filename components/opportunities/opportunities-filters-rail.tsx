'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { usePathname, useRouter } from '@/i18n/routing'
import { useTranslations } from 'next-intl'
import { Filter } from 'lucide-react'
import OpportunitiesFiltersPanel from '@/components/opportunities/opportunities-filters-panel'

type FilterState = Parameters<NonNullable<Parameters<typeof OpportunitiesFiltersPanel>[0]['onFiltersApplied']>>[0]

function filtersFromSearchParams(searchParams: URLSearchParams): Partial<FilterState> {
  return {
    search: searchParams.get('q') || '',
    types: searchParams.get('types')?.split(',').filter(Boolean) || [],
    categories: searchParams.get('categories')?.split(',').filter(Boolean) || [],
    location: searchParams.get('location') || '',
    budgetMin: searchParams.get('budgetMin') || '',
    budgetMax: searchParams.get('budgetMax') || '',
    currency: searchParams.get('currency') || 'USD',
    priority: searchParams.get('priority') || '',
    deadline: searchParams.get('deadline') || '',
    entityVerified:
      searchParams.get('entityVerified') === 'true'
        ? true
        : searchParams.get('entityVerified') === 'false'
          ? false
          : null,
    hasDeadline:
      searchParams.get('hasDeadline') === 'true'
        ? true
        : searchParams.get('hasDeadline') === 'false'
          ? false
          : null,
  }
}

function filtersToSearchParams(filters: FilterState, current: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(current.toString())

  const setOrDelete = (key: string, value: string | null | undefined) => {
    if (value) params.set(key, value)
    else params.delete(key)
  }

  setOrDelete('q', filters.search || null)
  setOrDelete('types', filters.types.length ? filters.types.join(',') : null)
  setOrDelete('categories', filters.categories.length ? filters.categories.join(',') : null)
  setOrDelete('location', filters.location || null)
  setOrDelete('budgetMin', filters.budgetMin || null)
  setOrDelete('budgetMax', filters.budgetMax || null)
  if (filters.currency && filters.currency !== 'USD') params.set('currency', filters.currency)
  else params.delete('currency')
  setOrDelete('priority', filters.priority || null)
  setOrDelete('deadline', filters.deadline || null)
  if (filters.entityVerified === true) params.set('entityVerified', 'true')
  else if (filters.entityVerified === false) params.set('entityVerified', 'false')
  else params.delete('entityVerified')
  if (filters.hasDeadline === true) params.set('hasDeadline', 'true')
  else if (filters.hasDeadline === false) params.set('hasDeadline', 'false')
  else params.delete('hasDeadline')

  return params
}

export default function OpportunitiesFiltersRail() {
  const t = useTranslations('modules.opportunities')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const initialFilters = filtersFromSearchParams(searchParams)
  const skipNextApply = useRef(true)

  const handleFiltersApplied = useCallback(
    (filters: FilterState) => {
      if (skipNextApply.current) {
        skipNextApply.current = false
        return
      }
      const params = filtersToSearchParams(filters, new URLSearchParams(searchParams.toString()))
      const qs = params.toString()
      router.replace((qs ? `${pathname}?${qs}` : pathname) as Parameters<typeof router.replace>[0], {
        scroll: false,
      })
    },
    [pathname, router, searchParams],
  )

  useEffect(() => {
    skipNextApply.current = true
  }, [searchParams])

  return (
    <div className="flex flex-col min-h-0 text-foreground">
      <div className="flex-shrink-0 pb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Filter className="h-5 w-5 shrink-0" />
          {t('filters.searchLabel')}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">{t('filters.subtitle')}</p>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        <OpportunitiesFiltersPanel
          initialFilters={initialFilters}
          onFiltersApplied={handleFiltersApplied}
        />
      </div>
    </div>
  )
}
