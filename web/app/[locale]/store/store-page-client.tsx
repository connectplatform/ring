'use client'

// Import hooks and types
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { Locale } from '@/i18n/shared'
import { useStore } from '@/features/store/context'
import { useTranslations } from 'next-intl'
import { DEFAULT_STORE_FILTERS, type StoreFilterState } from '@/lib/store-constants'
import type { CatalogPriceBounds } from '@/lib/store-price-range'
import type { NicheFacet } from '@/features/store/niche/niche-facets'
import type { StoreProduct } from '@/features/store/types'
import {
  NICHE_CATALOG_GRID_CLASS,
  NicheCatalogView,
  NicheProductCard,
} from '@/components/store/niche-catalog'
import { productCardImageSrc } from '@/features/store/components/product-card'
import { useCursorFeed } from '@/hooks/use-cursor-feed'
import { buildFilterFingerprint } from '@/lib/pagination/filter-fingerprint'
import { RingBreadcrumbs } from '@/components/common/ring-breadcrumbs'
import { ROUTES } from '@/constants/routes'
import { markStoreListLeft, rememberStoreListLocation } from '@/lib/pagination/store-list-return'

interface StorePageClientProps {
  locale: Locale
  onCountsUpdate?: (totalRecords: number, filteredRecords?: number) => void
  onPriceRangeUpdate?: (bounds: CatalogPriceBounds) => void
  onNicheFacetsUpdate?: (facets: NicheFacet[] | null) => void
  filters?: StoreFilterState
}

export default function StorePageClient({
  locale,
  onCountsUpdate,
  onPriceRangeUpdate,
  onNicheFacetsUpdate,
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
  const [unavailableImageIds, setUnavailableImageIds] = useState<ReadonlySet<string>>(() => new Set())
  const [shippableMax, setShippableMax] = useState<Record<string, number | null>>({})
  const markImageUnavailable = useCallback((productId: string) => {
    setUnavailableImageIds((prev) => {
      if (prev.has(productId)) return prev
      const next = new Set(prev)
      next.add(productId)
      return next
    })
  }, [])

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

  // Remember this list URL (path + search) so product details can return here.
  useEffect(() => {
    rememberStoreListLocation()
    return () => markStoreListLeft()
  }, [])

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
    }, 500)

    // Cleanup any running debounce timer on filter or debouncedFilters change
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [filters, debouncedFilters])

  // Asynchronously fetch products for the store page (with cursor for pagination)
  const listFingerprintRef = useRef(filterFingerprint)
  listFingerprintRef.current = filterFingerprint

  const fetchStorePage = useCallback(
    async (cursor: string | null) => {
      const fingerprintAtStart = listFingerprintRef.current
      const filtersForRequest = debouncedFiltersRef.current
      // Dynamic import for server action to avoid bundling on client
      const { getStoreProducts } = await import('@/app/_actions/store-products')
      const data = await getStoreProducts({
        ...filtersForRequest,
        limit: STORE_PAGE_SIZE,
        startAfter: cursor ?? undefined,
      })

      if (!data.success) {
        throw new Error(data.error || 'Failed to load products')
      }

      const stale = fingerprintAtStart !== listFingerprintRef.current
      // Convert result to array
      const newItems = Array.isArray(data.items) ? data.items : []
      // A cleared filter must not inherit the previous query's "0 found" count.
      if (!stale) {
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

      if (!cursor && data.nicheFacets) {
        onNicheFacetsUpdate?.(data.nicheFacets)
      }
      }

      // Return results for infinite scroll feed
      return {
        items: newItems,
        cursor: data.lastVisible ?? null,
        hasMore: Boolean(data.lastVisible),
      }
    },
    [catalogFilterKey, onPriceRangeUpdate, onNicheFacetsUpdate],
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
    limit: STORE_PAGE_SIZE,
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
    (filters.priceMax != null && filters.priceMax > 0) ||
    filters.inStock !== null ||
    Boolean(filters.vendor) ||
    Boolean(filters.niche && Object.keys(filters.niche).length > 0)

  // Call counts update callback when records or filters change
  useEffect(() => {
    onCountsUpdate?.(totalRecords, hasActiveFilters ? filteredRecords : undefined)
  }, [totalRecords, filteredRecords, hasActiveFilters, onCountsUpdate])

  const shippableKey = items.map((item) => item.id).join(',')
  useEffect(() => {
    const ids = shippableKey.split(',').filter(Boolean)
    const missing = ids.filter((id) => !(id in shippableMax))
    if (missing.length === 0) return
    let cancelled = false
    void (async () => {
      const next: Record<string, number | null> = {}
      for (let index = 0; index < missing.length; index += 40) {
        const slice = missing.slice(index, index + 40)
        const response = await fetch(
          `/api/store/fulfillment/shippable?ids=${encodeURIComponent(slice.join(','))}`,
          { credentials: 'include' },
        )
        if (!response.ok) continue
        const body = (await response.json()) as {
          items?: Array<{ productId?: string; max?: number | null }>
        }
        for (const row of body.items || []) {
          if (!row.productId) continue
          next[row.productId] = row.max === null || typeof row.max === 'number' ? row.max : 0
        }
      }
      if (!cancelled && Object.keys(next).length > 0) {
        setShippableMax((prev) => ({ ...prev, ...next }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [shippableKey, shippableMax])

  // Main rendering logic
  return (
    <NicheCatalogView>
    <div>
      {/* Header/title row */}
      <div className="mb-6 space-y-3">
        <RingBreadcrumbs items={[{ label: t('title'), href: ROUTES.STORE(locale) }]} />
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
        </div>
      </div>

      <div className="@container/inventory">
      {/* Product grid; show skeletons when loading and nothing loaded; otherwise, show products */}
      {loading && items.length === 0 ? (
        <div className={NICHE_CATALOG_GRID_CLASS}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border p-4">
              <div className="mb-4 h-48 w-full rounded bg-muted" />
              <div className="mb-2 h-4 w-3/4 rounded bg-muted" />
              <div className="h-4 w-1/2 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : (
        <StoreProductSections
          items={items as StoreProduct[]}
          locale={locale}
          unavailableImageIds={unavailableImageIds}
          onImageUnavailable={markImageUnavailable}
          shippableMax={shippableMax}
          withPhotoLabel={t('sectionWithPhoto')}
          noPhotoLabel={t('sectionNoPhoto')}
        />
      )}
      </div>

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
    </NicheCatalogView>
  )
}

const STORE_PAGE_SIZE = 24

function productHasPhoto(product: StoreProduct, unavailableImageIds: ReadonlySet<string>) {
  return Boolean(productCardImageSrc(product)) && !unavailableImageIds.has(product.id)
}

function StoreProductSections({
  items,
  locale,
  unavailableImageIds,
  onImageUnavailable,
  shippableMax,
  withPhotoLabel,
  noPhotoLabel,
}: {
  items: StoreProduct[]
  locale: Locale
  unavailableImageIds: ReadonlySet<string>
  onImageUnavailable: (productId: string) => void
  shippableMax: Record<string, number | null>
  withPhotoLabel: string
  noPhotoLabel: string
}) {
  // First fetched page stays the head. No-photo rows sit at the end of that
  // page. Later infinite-scroll pages render after them, so the no-photo
  // block does not get pushed down by every new fetch.
  const head = items.slice(0, STORE_PAGE_SIZE)
  const tail = items.slice(STORE_PAGE_SIZE)
  const hasPhoto = (product: StoreProduct) => productHasPhoto(product, unavailableImageIds)
  const headPhotos = head.filter(hasPhoto)
  const noPhoto = [...head.filter((product) => !hasPhoto(product)), ...tail.filter((product) => !hasPhoto(product))]
  const tailPhotos = tail.filter(hasPhoto)
  const split = headPhotos.length > 0 && noPhoto.length > 0

  return (
    <div className="space-y-8">
      {headPhotos.length > 0 ? (
        <section>
          {split ? (
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground">
              {withPhotoLabel}
            </h2>
          ) : null}
          <div className={NICHE_CATALOG_GRID_CLASS}>
            {headPhotos.map((product) => (
              <NicheProductCard
                key={product.id}
                product={product}
                locale={locale}
                layout="photo"
                onImageUnavailable={onImageUnavailable}
                shippableMax={shippableMax[product.id]}
              />
            ))}
          </div>
        </section>
      ) : null}
      {noPhoto.length > 0 ? (
        <section>
          {split || tailPhotos.length > 0 ? (
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground">
              {noPhotoLabel}
            </h2>
          ) : null}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {noPhoto.map((product) => (
              <NicheProductCard
                key={product.id}
                product={product}
                locale={locale}
                layout="plain"
                shippableMax={shippableMax[product.id]}
              />
            ))}
          </div>
        </section>
      ) : null}
      {tailPhotos.length > 0 ? (
        <section>
          <div className={NICHE_CATALOG_GRID_CLASS}>
            {tailPhotos.map((product) => (
              <NicheProductCard
                key={product.id}
                product={product}
                locale={locale}
                layout="photo"
                onImageUnavailable={onImageUnavailable}
                shippableMax={shippableMax[product.id]}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

// TODO: With React 19+ and Next.js 16, use useActionState or use server actions directly
// for product loading to simplify loading state and cache handling.
// TODO: Use useDeferredValue for filter state debouncing instead of manual setTimeout pattern (React 19).
// TODO: Consider concurrent rendering features (useOptimistic/use) to further improve perceived UI perf.