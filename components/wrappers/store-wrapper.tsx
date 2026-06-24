'use client'

import React, { useState, useCallback, useEffect, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import StoreFiltersPanel from '@/components/store/store-filters-panel'
import FloatingButtons from '@/components/store/floating-buttons'
import VendorCTACard from '@/components/vendor/vendor-cta-card'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
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
      <RingRightRailLayout flushCenterPane showRightRail={false}>
        <DavinciCenterPane contentClassName="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </DavinciCenterPane>
      </RingRightRailLayout>
    )
  }

  return (
    <RingRightRailLayout flushCenterPane rightRail={filtersRail}>
      <DavinciCenterPane className="relative">
        {childrenWithProps}
        <FloatingButtons
          key={`floating-${currentLocale}`}
          locale={locale}
          currentSort={filters.sortBy}
          onSortChange={handleSortChange}
        />
      </DavinciCenterPane>
    </RingRightRailLayout>
  )
}
