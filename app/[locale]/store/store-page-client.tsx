'use client'

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
  const [, startTransition] = useTransition()
  const { products } = useStore()
  const t = useTranslations('modules.store')

  const filters = useMemo(() => parentFilters || DEFAULT_STORE_FILTERS, [parentFilters])
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [debouncedFilters, setDebouncedFilters] = useState(() => filters)
  const debouncedFiltersRef = useRef(debouncedFilters)
  const lastCatalogFilterKeyRef = useRef<string | null>(null)

  const [totalRecords, setTotalRecords] = useState(0)
  const [filteredRecords, setFilteredRecords] = useState<number | undefined>(undefined)

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

  const filterFingerprint = useMemo(
    () => buildFilterFingerprint('store', debouncedFilters as unknown as Record<string, unknown>),
    [debouncedFilters],
  )

  useEffect(() => {
    debouncedFiltersRef.current = debouncedFilters
  }, [debouncedFilters])

  useEffect(() => {
    const filtersJson = JSON.stringify(filters)
    const debouncedJson = JSON.stringify(debouncedFilters)
    if (filtersJson === debouncedJson) return

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      startTransition(() => setDebouncedFilters(filters))
    }, 750)

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [filters, debouncedFilters])

  const fetchStorePage = useCallback(
    async (cursor: string | null) => {
      const { getStoreProducts } = await import('@/app/_actions/store-products')
      const data = await getStoreProducts({
        ...debouncedFiltersRef.current,
        limit: 24,
        startAfter: cursor ?? undefined,
      })

      if (!data.success) {
        throw new Error(data.error || 'Failed to load products')
      }

      const newItems = Array.isArray(data.items) ? data.items : []
      setTotalRecords(data.total ?? newItems.length)
      setFilteredRecords(data.filteredTotal)

      if (
        data.priceRange &&
        lastCatalogFilterKeyRef.current !== catalogFilterKey
      ) {
        lastCatalogFilterKeyRef.current = catalogFilterKey
        onPriceRangeUpdate?.(data.priceRange)
      }

      return {
        items: newItems,
        cursor: data.lastVisible ?? null,
        hasMore: Boolean(data.lastVisible),
      }
    },
    [catalogFilterKey, onPriceRangeUpdate],
  )

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

  const hasInitializedRef = useRef(false)
  useEffect(() => {
    if (!hasInitializedRef.current && Array.isArray(products) && products.length > 0 && items.length === 0) {
      hasInitializedRef.current = true
    }
  }, [items.length, products])

  const hasActiveFilters =
    filters.search !== '' ||
    filters.categories.length > 0 ||
    filters.priceMin > 0 ||
    (filters.priceMax !== null && filters.priceMax !== undefined) ||
    filters.inStock !== null

  useEffect(() => {
    onCountsUpdate?.(totalRecords, hasActiveFilters ? filteredRecords : undefined)
  }, [totalRecords, filteredRecords, hasActiveFilters, onCountsUpdate])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
      </div>

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

      {loading && items.length > 0 && (
        <div className="flex justify-center py-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-primary" />
            <span className="text-sm">{t('loading')}</span>
          </div>
        </div>
      )}

      {hasMore && <div ref={sentinelRef} className="h-10" />}
    </div>
  )
}
