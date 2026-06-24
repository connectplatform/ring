'use client'

import { Suspense } from 'react'
import type { Locale } from '@/i18n/shared'
import OpportunitiesNavRail from '@/components/opportunities/opportunities-nav-rail'
import OpportunitiesFiltersRail from '@/components/opportunities/opportunities-filters-rail'

interface OpportunitiesBrowseRailProps {
  locale: Locale
  onNavigate?: () => void
}

/** Right rail: section nav buttons + search/filters (no filter title header). */
export default function OpportunitiesBrowseRail({ locale, onNavigate }: OpportunitiesBrowseRailProps) {
  return (
    <div className="flex min-h-0 flex-col gap-4 text-foreground">
      <OpportunitiesNavRail locale={locale} onNavigate={onNavigate} />
      <Suspense fallback={<div className="h-24 animate-pulse rounded-xl bg-muted/40" />}>
        <OpportunitiesFiltersRail hideHeader />
      </Suspense>
    </div>
  )
}
