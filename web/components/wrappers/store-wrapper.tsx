'use client'

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useTransition,
  // TODO: Add useOptimistic (React 19) for better concurrent interactions
  // TODO: Consider useActionState for optimistic UI and async state flows
} from 'react'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import StoreFiltersPanel from '@/components/store/store-filters-panel'
import FloatingButtons from '@/components/store/floating-buttons'
import VendorCTACard from '@/components/vendor/vendor-cta-card'
import { StoreShareEarnCard } from '@/components/store/store-share-earn-card'
import type { Locale } from '@/i18n/shared'
import { DEFAULT_STORE_FILTERS, type StoreFilterState } from '@/lib/store-constants'
import type { CatalogPriceBounds } from '@/lib/store-price-range'

// Static client imports (wallet/admin SSOT) — avoid next/dynamic default/named interop
// under Turbopack that can yield undefined element types on /store.

// ----------- Storage Constants -----------
// TODO: After planned @store-page-client upgrade, storage scheme may need namespacing per user/session
const STORAGE_KEY = `ring-store-filters-${process.env.NEXT_PUBLIC_APP_DOMAIN || (typeof window !== 'undefined' ? window.location.hostname : 'local')}`
const STORAGE_VERSION = 'v2' // TODO: Bump version if schema changes on store-page-client upgrade

interface StoreWrapperProps {
  children: React.ReactElement<any> // Typically a store page's main content/component
  locale: Locale
}

export default function StoreWrapper({ children, locale }: StoreWrapperProps) {
  // ----------- State Hooks -----------
  const currentLocale = locale.toLowerCase()
  // Total available store records for context/UI summary
  const [totalRecords, setTotalRecords] = useState(0)
  // Subset after filtering (may be undefined before count is known)
  const [filteredRecords, setFilteredRecords] = useState<number | undefined>(undefined)
  // All applied filters (local + remote)
  const [filters, setFilters] = useState<StoreFilterState>(DEFAULT_STORE_FILTERS)
  // Hydration flag - disables rendering/interaction until rehydrated for localStorage consistency
  const [isHydrated, setIsHydrated] = useState(false)
  // Current price range for catalog, bounds calculated remotely
  const [catalogPriceBounds, setCatalogPriceBounds] = useState<CatalogPriceBounds | null>(null)

  // ----------- React Transition -----------
  // REQUIRED for concurrent updates (React 18+) -- planned store-page-client upgrade will use React 19 features
  const [, startTransition] = useTransition()
  // Keep ref to startTransition, solves issues if next version re-renders callbacks (per TODOs in store-page-client)
  const startTransitionRef = useRef(startTransition)
  startTransitionRef.current = startTransition // Keep most recent for callback use

  // ----------- Effects -----------

  // Storage rehydration: load filters and meta from localStorage on first mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      // Restore saved filters from localStorage, only if not stale (24 hours)
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        if (
          data.version === STORAGE_VERSION &&
          Date.now() - data.timestamp < 24 * 60 * 60 * 1000 &&
          data.filters // Must still have a filters object
        ) {
          setFilters(data.filters)
        } else {
          localStorage.removeItem(STORAGE_KEY)
        }
      }
    } catch {
      // Defensive: remove broken/malformed store
      localStorage.removeItem(STORAGE_KEY)
    }
    setIsHydrated(true) // Mark ready for UI display
  }, [])

  // Save filters to localStorage when they change (avoid on SSR/hydrating)
  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return
    try {
      // Serializes filter state and timestamp, for light persistence/restoration
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: STORAGE_VERSION,
          filters,
          timestamp: Date.now(),
        })
      )
    } catch {
      // TODO: Add non-blocking error reporting/logging for quota reached
    }
  }, [filters, isHydrated])

  // ----------- Event / Callback Handlers -----------

  // Main counts update (comes from child via onCountsUpdate)
  // NOTE: store-page-client will likely forward both total and filtered count
  const handleCountsUpdate = useCallback((total: number, filtered?: number) => {
    setTotalRecords(total)
    setFilteredRecords(filtered)
  }, [])

  // Main price-range update (from server/catalog query)
  // Only update if value materially changes (avoids extra renders)
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

  // Filters update from child panel (async transition for smooth UI)
  // TODO: When using React 19+, convert to useOptimistic state for better UI feedback
  const handleFiltersChange = useCallback((newFilters: StoreFilterState) => {
    startTransitionRef.current(() => setFilters(newFilters))
    // TODO: If store-page-client passes async results or optimistic data, refactor to use native useOptimistic
  }, [])

  // Sorting logic (typically via FloatingButtons, directly updates sort property of filters)
  const handleSortChange = useCallback((sortBy: string) => {
    startTransitionRef.current(() =>
      setFilters((prev) => ({ ...prev, sortBy }))
    )
    // TODO: If sort-by will soon be decoupled, refactor to dedicated state and use reducer or concurrent feature
  }, [])

  // ----------- Child Injection -----------
  // Clone children, injecting new props used for event/analytics/connection to filters panel
  // TODO: Once store-page-client migrates to composition API or context, prefer context for prop drilling elimination
  const childrenWithProps = React.cloneElement(children, {
    onCountsUpdate: handleCountsUpdate,
    onPriceRangeUpdate: handlePriceRangeUpdate,
    filters, // Pass filters for consistency/UI
  })

  // ----------- Side Rail Entries -----------
  // Compose the right-rail: filters panel above, vendor CTA below
  const filtersRail = (
    <>
      <StoreFiltersPanel
        locale={locale}
        totalRecords={totalRecords}
        filteredRecords={filteredRecords}
        onFiltersApplied={handleFiltersChange}
        persistedFilters={filters}
        catalogPriceBounds={catalogPriceBounds}
        // TODO: store-page-client might require context or additional props in future upgrade
      />
      <div className="mt-6 space-y-4">
        <StoreShareEarnCard />
        <VendorCTACard />
      </div>
    </>
  )

  // ----------- Initial Loading State -----------
  // Wait for browser hydration and/or filter restoration before rendering children/store UI
  if (!isHydrated) {
    // Minimal loading spinner UX (centered)
    return (
      <RingRightRailLayout flushCenterPane showRightRail={false}>
        <DavinciCenterPane contentClassName="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </DavinciCenterPane>
      </RingRightRailLayout>
    )
  }

  // ----------- Main Render Block -----------
  // Provide right-rail and inject children with filtering/sorting/price controls
  return (
    <RingRightRailLayout
      flushCenterPane
      rightRailPurpose="store"
      rightRailContent={[
        { blockType: 'store-filters' },
        { blockType: 'share-earn' },
        { blockType: 'vendor-cta' },
      ]}
      rightRail={filtersRail}
    >
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

// Codemod / React 19 + Next 16 follow-ups (store stack → wallet parity):
// - Replace manual isHydrated with useSyncExternalStore for localStorage filter restore
// - useDeferredValue for filter debounce (replace setTimeout)
// - useOptimistic for filter/sort feedback
// - Prefer composition/context over cloneElement prop drilling
// - Multitab: window 'storage' listener on STORAGE_KEY