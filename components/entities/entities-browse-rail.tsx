'use client'

import { Suspense } from 'react'
import type { Locale } from '@/i18n/shared'
import EntitiesNavRail from '@/components/entities/entities-nav-rail'
import EntitiesFiltersRail from '@/components/entities/entities-filters-rail'

interface EntitiesBrowseRailProps {
  locale: Locale
  onNavigate?: () => void
}

/** Right rail: section nav + search/filters (no filter title header). */
export default function EntitiesBrowseRail({ locale, onNavigate }: EntitiesBrowseRailProps) {
  return (
    <div className="flex min-h-0 flex-col gap-4 text-foreground">
      <EntitiesNavRail locale={locale} onNavigate={onNavigate} />
      <Suspense fallback={<div className="h-24 animate-pulse rounded-xl bg-muted/40" />}>
        <EntitiesFiltersRail hideHeader />
      </Suspense>
    </div>
  )
}
