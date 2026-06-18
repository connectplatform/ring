'use client'

import { Suspense, useState, useEffect, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { usePathname } from '@/i18n/routing'
import type { SerializedEntity } from '@/features/entities/types'
import { EntitySuspenseBoundary } from '@/components/suspense/enhanced-suspense-boundary'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import EntitiesFiltersRail from '@/components/entities/entities-filters-rail'

const EntitiesContent = dynamic(() => import('@/features/entities/components/entities'), {
  ssr: false,
})

interface EntitiesWrapperProps {
  initialEntities: SerializedEntity[]
  initialError: string | null
  page: number
  totalPages: number
  totalEntities: number
  lastVisible: string | null
  initialLimit: number
  initialSort: string
  initialFilter: string
}

/**
 * Entities list wrapper — store SSOT: RingRightRailLayout + filter rail on browse list.
 */
export default function EntitiesWrapper({
  initialEntities,
  initialError,
  page,
  totalPages,
  totalEntities,
  lastVisible,
  initialLimit,
  initialSort,
  initialFilter,
}: EntitiesWrapperProps) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const t = useTranslations('modules.entities.wrapper')
  const [mounted, setMounted] = useState(false)
  const [entities, setEntities] = useState<SerializedEntity[]>(initialEntities)
  const [error, setError] = useState<string | null>(initialError)
  const [limit, setLimit] = useState(initialLimit)
  const [sort, setSort] = useState(initialSort)
  const [filter, setFilter] = useState(initialFilter)
  const [, startTransition] = useTransition()

  const isBrowseListPage = pathname === '/entities'

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const limitParam = searchParams.get('limit')
    const sortParam = searchParams.get('sort')
    const filterParam = searchParams.get('filter')

    if (limitParam) setLimit(Number.parseInt(limitParam, 10))
    if (sortParam) setSort(sortParam)
    if (filterParam) startTransition(() => setFilter(filterParam))
  }, [searchParams, mounted, startTransition])

  if (!mounted) {
    return (
      <EntitySuspenseBoundary
        level="page"
        showProgress={true}
        description={t('preparingDirectory')}
        retryEnabled={false}
      >
        <div />
      </EntitySuspenseBoundary>
    )
  }

  const listContent = (
    <div className="min-w-0 min-h-full px-4 py-4 sm:px-6">
      <EntitySuspenseBoundary
        level="page"
        showProgress={true}
        description={t('loadingDirectory')}
        retryEnabled={true}
        onRetry={() => window.location.reload()}
      >
        <EntitiesContent
          initialEntities={entities}
          initialError={error}
          page={page}
          totalPages={totalPages}
          totalEntities={totalEntities}
          lastVisible={lastVisible}
          limit={limit}
          sort={sort}
          filter={filter}
        />
      </EntitySuspenseBoundary>
    </div>
  )

  if (isBrowseListPage) {
    return (
      <RingRightRailLayout
        showRightRail
        rightRail={
          <Suspense fallback={<div className="h-32 animate-pulse rounded-md bg-muted/40" />}>
            <EntitiesFiltersRail />
          </Suspense>
        }
        contentClassName="pb-24 lg:pb-8"
      >
        {listContent}
      </RingRightRailLayout>
    )
  }

  return listContent
}
