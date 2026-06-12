'use client'

import React, { useState, useCallback, useEffect, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import StoreFiltersPanel from '@/components/store/store-filters-panel'
import FloatingButtons from '@/components/store/floating-buttons'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import VendorCTACard from '@/components/vendor/vendor-cta-card'
import { RingContentPanel } from '@/components/layout/ring-app-shell'
import type { Locale } from '@/i18n/shared'
import { DEFAULT_STORE_FILTERS, type StoreFilterState } from '@/lib/store-constants'
import type { CatalogPriceBounds } from '@/lib/store-price-range'

const STORAGE_KEY = `ring-store-filters-${process.env.NEXT_PUBLIC_APP_DOMAIN || typeof window !== 'undefined' ? window.location.hostname : 'local'}`
const STORAGE_VERSION = 'v2'

interface StoreWrapperProps {
  children: React.ReactElement<any>
  locale: Locale
}

export default function StoreWrapper({ children, locale }: StoreWrapperProps) {
  const currentLocale = locale.toLowerCase()
  const [totalRecords, setTotalRecords] = useState(0)
  const [filteredRecords, setFilteredRecords] = useState<number | undefined>(undefined)
  const [filters, setFilters] = useState<StoreFilterState>(DEFAULT_STORE_FILTERS)
  const [isHydrated, setIsHydrated] = useState(false)
  const [catalogPriceBounds, setCatalogPriceBounds] = useState<CatalogPriceBounds | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        if (
          data.version === STORAGE_VERSION &&
          Date.now() - data.timestamp < 24 * 60 * 60 * 1000 &&
          data.filters
        ) {
          setFilters(data.filters)
        } else {
          localStorage.removeItem(STORAGE_KEY)
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: STORAGE_VERSION, filters, timestamp: Date.now() }),
      )
    } catch {
      /* ignore */
    }
  }, [filters, isHydrated])

  const handleCountsUpdate = useCallback((total: number, filtered?: number) => {
    setTotalRecords(total)
    setFilteredRecords(filtered)
  }, [])

  const handlePriceRangeUpdate = useCallback((bounds: CatalogPriceBounds) => {
    setCatalogPriceBounds((prev) => {
      if (
        prev &&
        prev.enabled === bounds.enabled &&
        prev.minPrice === bounds.minPrice &&
        prev.maxPrice === bounds.maxPrice &&
        prev.catalogMatchCount === bounds.catalogMatchCount
      ) {
        return prev
      }
      return bounds
    })
  }, [])

  const handleFiltersChange = useCallback((newFilters: StoreFilterState) => {
    startTransition(() => setFilters(newFilters))
  }, [startTransition])

  const handleSortChange = useCallback(
    (sortBy: string) => {
      startTransition(() => setFilters((prev) => ({ ...prev, sortBy })))
    },
    [startTransition],
  )

  const childrenWithProps = React.cloneElement(children, {
    onCountsUpdate: handleCountsUpdate,
    onPriceRangeUpdate: handlePriceRangeUpdate,
    filters,
  })

  const filtersRail = (
    <>
      <StoreFiltersPanel
        locale={locale}
        totalRecords={totalRecords}
        filteredRecords={filteredRecords}
        onFiltersApplied={handleFiltersChange}
        persistedFilters={filters}
        catalogPriceBounds={catalogPriceBounds}
      />
      <div className="mt-6">
        <VendorCTACard />
      </div>
    </>
  )

  if (!isHydrated) {
    return (
      <div className="min-h-full">
        <RingContentPanel className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </RingContentPanel>
      </div>
    )
  }

  return (
    <div className="min-h-full">
      <div className="hidden min-h-full gap-3 lg:flex" key={`desktop-${currentLocale}`}>
        <RingContentPanel className="relative flex-1 min-w-0">
          {childrenWithProps}
          <FloatingButtons
            key={`floating-${currentLocale}`}
            locale={locale}
            currentSort={filters.sortBy}
            onSortChange={handleSortChange}
          />
        </RingContentPanel>
        <aside className="ring-right-rail w-[300px] shrink-0 self-stretch min-h-0">
          <div className="sticky top-0 px-3 pt-4 pb-6 pr-4">{filtersRail}</div>
        </aside>
      </div>

      <div className="hidden min-h-full md:block lg:hidden" key={`ipad-${currentLocale}`}>
        <RingContentPanel className="relative min-h-full">
          {childrenWithProps}
          <FloatingButtons
            key={`floating-ipad-${currentLocale}`}
            locale={locale}
            currentSort={filters.sortBy}
            onSortChange={handleSortChange}
          />
          <FloatingSidebarToggle key={`toggle-ipad-${currentLocale}`}>
            <div className="space-y-4">{filtersRail}</div>
          </FloatingSidebarToggle>
        </RingContentPanel>
      </div>

      <div className="md:hidden px-1 pb-4" key={`mobile-${currentLocale}`}>
        <RingContentPanel className="relative min-h-full">
          {childrenWithProps}
          <FloatingButtons
            key={`floating-mobile-${currentLocale}`}
            locale={locale}
            currentSort={filters.sortBy}
            onSortChange={handleSortChange}
          />
          <FloatingSidebarToggle key={`toggle-mobile-${currentLocale}`}>
            <div className="space-y-4">{filtersRail}</div>
          </FloatingSidebarToggle>
        </RingContentPanel>
      </div>
    </div>
  )
}
