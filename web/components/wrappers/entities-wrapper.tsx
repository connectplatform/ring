'use client'

import { useState, useEffect, useTransition, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { usePathname } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import type { SerializedEntity } from '@/features/entities/types'
import { EntitySuspenseBoundary } from '@/components/suspense/enhanced-suspense-boundary'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import EntitiesBrowseRail from '@/components/entities/entities-browse-rail'

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
  const locale = useLocale() as Locale
  const t = useTranslations('modules.entities.wrapper')
  const [mounted, setMounted] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
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

  const closeRail = useCallback(() => setRightSidebarOpen(false), [])
  const retryReload = useCallback(() => window.location.reload(), [])

  const rightRail = useMemo(
    () => <EntitiesBrowseRail locale={locale} onNavigate={closeRail} />,
    [locale, closeRail],
  )

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
    <DavinciCenterPane>
      <EntitySuspenseBoundary
        level="page"
        showProgress={true}
        description={t('loadingDirectory')}
        retryEnabled={true}
        onRetry={retryReload}
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
    </DavinciCenterPane>
  )

  if (isBrowseListPage) {
    return (
      <RingRightRailLayout
        showRightRail
        flushCenterPane
        isOpen={rightSidebarOpen}
        onToggle={setRightSidebarOpen}
        rightRail={rightRail}
      >
        {listContent}
      </RingRightRailLayout>
    )
  }

  return listContent
}
