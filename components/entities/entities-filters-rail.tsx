'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { usePathname, useRouter } from '@/i18n/routing'
import { useTranslations } from 'next-intl'
import { Filter } from 'lucide-react'
import type { EntityType } from '@/features/entities/types'
import EntitiesFiltersPanel from '@/components/entities/entities-filters-panel'

type EntityFilterState = Parameters<NonNullable<Parameters<typeof EntitiesFiltersPanel>[0]['onFiltersApplied']>>[0]

function filtersFromSearchParams(searchParams: URLSearchParams): Partial<EntityFilterState> {
  return {
    search: searchParams.get('q') || '',
    types: (searchParams.get('types')?.split(',').filter(Boolean) || []) as EntityType[],
    location: searchParams.get('location') || '',
    employeeCountMin: searchParams.get('employeeMin') || '',
    employeeCountMax: searchParams.get('employeeMax') || '',
    foundedYearMin: searchParams.get('foundedMin') || '',
    foundedYearMax: searchParams.get('foundedMax') || '',
    verificationStatus: searchParams.get('verification') || '',
    membershipTier: searchParams.get('tier') || '',
    services: searchParams.get('services')?.split(',').filter(Boolean) || [],
    certifications:
      searchParams.get('certifications') === 'true'
        ? true
        : searchParams.get('certifications') === 'false'
          ? false
          : null,
    partnerships:
      searchParams.get('partnerships') === 'true'
        ? true
        : searchParams.get('partnerships') === 'false'
          ? false
          : null,
  }
}

function filtersToSearchParams(filters: EntityFilterState, current: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(current.toString())

  const setOrDelete = (key: string, value: string | null | undefined) => {
    if (value) params.set(key, value)
    else params.delete(key)
  }

  setOrDelete('q', filters.search || null)
  setOrDelete('types', filters.types.length ? filters.types.join(',') : null)
  setOrDelete('location', filters.location || null)
  setOrDelete('employeeMin', filters.employeeCountMin || null)
  setOrDelete('employeeMax', filters.employeeCountMax || null)
  setOrDelete('foundedMin', filters.foundedYearMin || null)
  setOrDelete('foundedMax', filters.foundedYearMax || null)
  setOrDelete('verification', filters.verificationStatus || null)
  setOrDelete('tier', filters.membershipTier || null)
  setOrDelete('services', filters.services.length ? filters.services.join(',') : null)
  if (filters.certifications === true) params.set('certifications', 'true')
  else if (filters.certifications === false) params.set('certifications', 'false')
  else params.delete('certifications')
  if (filters.partnerships === true) params.set('partnerships', 'true')
  else if (filters.partnerships === false) params.set('partnerships', 'false')
  else params.delete('partnerships')

  return params
}

interface EntitiesFiltersRailProps {
  /** Hide filter section title/subtitle (nav rail provides page context). */
  hideHeader?: boolean
}

export default function EntitiesFiltersRail({ hideHeader = false }: EntitiesFiltersRailProps) {
  const t = useTranslations('modules.entities')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const initialFilters = filtersFromSearchParams(searchParams)
  const skipNextApply = useRef(true)

  const handleFiltersApplied = useCallback(
    (filters: EntityFilterState) => {
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
    <div className="flex min-h-0 flex-col text-foreground">
      {!hideHeader && (
        <div className="shrink-0 pb-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Filter className="h-5 w-5 shrink-0" />
            {t('filters.title')}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{t('filters.subtitle')}</p>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <EntitiesFiltersPanel initialFilters={initialFilters} onFiltersApplied={handleFiltersApplied} />
      </div>
    </div>
  )
}
