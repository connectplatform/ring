'use client'

// Import hooks and types
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { Locale } from '@/i18n/shared'
import { useStore } from '@/features/store/context'
import { ProductCard } from '@/features/store/components/product-card'
import { useTranslations } from 'next-intl'
import { DEFAULT_STORE_FILTERS, type StoreFilterState } from '@/lib/store-constants'
import type { CatalogPriceBounds } from '@/lib/store-price-range'
import { useCursorFeed } from '@/hooks/use-cursor-feed'
import { buildFilterFingerprint } from '@/lib/pagination/filter-fingerprint'

interface StorePageClientProps {
  locale: Locale
  onCountsUpdate?: (totalRecords: number, filteredRecords?: number) => void
  onPriceRangeUpdate?: (bounds: CatalogPriceBounds) => void
  filters?: StoreFilterState
}

export default function StorePageClient({
  locale,
  onCountsUpdate,
  onPriceRangeUpdate,
  filters: parentFilters,
}: StorePageClientProps) {
  // useTransition to batch state updates and avoid excessive renders when updating filters
  const [, startTransition] = useTransition()

  // Access product list from store context
  const { products } = useStore()

  // Translations for the 'store' module
  const t = useTranslations('modules.store')

  // Memoize filters object, fallback to default if none provided
  const filters = useMemo(() => parentFilters || DEFAULT_STORE_FILTERS, [parentFilters])

  // Ref to debounce filter changes
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Debounced filters state
  const [debouncedFilters, setDebouncedFilters] = useState(() => filters)

  // Ref to keep current debouncedFilters between renders
  const debouncedFiltersRef = useRef(debouncedFilters)

  // Ref to track last catalog filters used for price range update
  const lastCatalogFilterKeyRef = useRef<string | null>(null)

  // Store and filtered record counts
  const [totalRecords, setTotalRecords] = useState(0)
  const [filteredRecords, setFilteredRecords] = useState<number | undefined>(undefined)

  // Key for comparing current debounced catalog filters (for use in price range tracking)
  const catalogFilterKey = useMemo(
    () =>
      JSON.stringify({
        search: debouncedFilters.search,
        categories: debouncedFilters.categories,
        vendor: debouncedFilters.vendor,
        inStock: debouncedFilters.inStock,
      }),
    [
      debouncedFilters.search,
      debouncedFilters.categories,
      debouncedFilters.vendor,
      debouncedFilters.inStock,
    ],
  )

  // Used by pagination/feed logic as an identifier for filter state
  const filterFingerprint = useMemo(
    () => buildFilterFingerprint('store', debouncedFilters as unknown as Record<string, unknown>),
    [debouncedFilters],
  )

  // Keep debouncedFilters ref reliably up-to-date for async fetches
  useEffect(() => {
    debouncedFiltersRef.current = debouncedFilters
  }, [debouncedFilters])

  // Debounce filter changes before updating actual request state
  useEffect(() => {
    const filtersJson = JSON.stringify(filters)
    const debouncedJson = JSON.stringify(debouncedFilters)
    if (filtersJson === debouncedJson) return

    // If a timer exists, clear it to restart debounce interval
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      // Use a transition to update search state without blocking urgent UI
      startTransition(() => setDebouncedFilters(filters))
    }, 750)

    // Cleanup any running debounce timer on filter or debouncedFilters change
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [filters, debouncedFilters])

  // Asynchronously fetch products for the store page (with cursor for pagination)
  const fetchStorePage = useCallback(
    async (cursor: string | null) => {
      // Dynamic import for server action to avoid bundling on client
      const { getStoreProducts } = await import('@/app/_actions/store-products')
      const data = await getStoreProducts({
        ...debouncedFiltersRef.current, // Always use latest debounced filters
        limit: 24,
        startAfter: cursor ?? undefined,
      })

      if (!data.success) {
        throw new Error(data.error || 'Failed to load products')
      }

      // Convert result to array
      const newItems = Array.isArray(data.items) ? data.items : []
      // Update record counters
      setTotalRecords(data.total ?? newItems.length)
      setFilteredRecords(data.filteredTotal)

      // Update price range if the filters have changed since last fetch
      if (
        data.priceRange &&
        lastCatalogFilterKeyRef.current !== catalogFilterKey
      ) {
        lastCatalogFilterKeyRef.current = catalogFilterKey
        onPriceRangeUpdate?.(data.priceRange)
      }

      // Return results for infinite scroll feed
      return {
        items: newItems,
        cursor: data.lastVisible ?? null,
        hasMore: Boolean(data.lastVisible),
      }
    },
    [catalogFilterKey, onPriceRangeUpdate],
  )

  // Custom cursor-based infinite scroll hook
  const {
    items,
    loading,
    hasMore,
    sentinelRef,
  } = useCursorFeed<{ id: string }>({
    moduleId: 'store',
    locale,
    limit: 24,
    filterFingerprint,
    initialItems: [],
    initialCursor: null,
    fetchPage: fetchStorePage,
  })

  // A ref to ensure we only flag initial data load once
  const hasInitializedRef = useRef(false)
  useEffect(() => {
    if (
      !hasInitializedRef.current &&
      Array.isArray(products) &&
      products.length > 0 &&
      items.length === 0
    ) {
      hasInitializedRef.current = true
    }
  }, [items.length, products])
  // TODO: Consider removing hasInitializedRef and using useEffect with actual initialized state from hook in React 19, using useOptimistic if appropriate.

  // Compute whether any filters (other than default) are active
  const hasActiveFilters =
    filters.search !== '' ||
    filters.categories.length > 0 ||
    filters.priceMin > 0 ||
    (filters.priceMax !== null && filters.priceMax !== undefined) ||
    filters.inStock !== null

  // Call counts update callback when records or filters change
  useEffect(() => {
    onCountsUpdate?.(totalRecords, hasActiveFilters ? filteredRecords : undefined)
  }, [totalRecords, filteredRecords, hasActiveFilters, onCountsUpdate])

  // Main rendering logic
  return (
    <div>
      {/* Header/title row */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
      </div>

      {/* Product grid; show skeletons when loading and nothing loaded; otherwise, show products */}
      {loading && items.length === 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border p-4">
              <div className="mb-4 h-48 w-full rounded bg-muted" />
              <div className="mb-2 h-4 w-3/4 rounded bg-muted" />
              <div className="h-4 w-1/2 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <ProductCard key={p.id} product={p as any} locale={locale} />
          ))}
        </div>
      )}

      {/* Inline loader when fetching more on scroll */}
      {loading && items.length > 0 && (
        <div className="flex justify-center py-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-primary" />
            <span className="text-sm">{t('loading')}</span>
          </div>
        </div>
      )}

      {/* Sentinel element for infinite scroll intersection observer */}
      {hasMore && <div ref={sentinelRef} className="h-10" />}
    </div>
  )
}

// TODO: With React 19+ and Next.js 16, use useActionState or use server actions directly
// for product loading to simplify loading state and cache handling.
// TODO: Use useDeferredValue for filter state debouncing instead of manual setTimeout pattern (React 19).
// TODO: Consider concurrent rendering features (useOptimistic/use) to further improve perceived UI perf.