'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { Locale } from '@/i18n-config'
import { useStore } from '@/features/store/context'
import { ProductCard } from '@/features/store/components/product-card'
import { useInView } from '@/hooks/use-intersection-observer'
import { useTranslations } from 'next-intl'
import { DEFAULT_STORE_FILTERS, type StoreFilterState } from '@/lib/store-constants'

interface StorePageClientProps {
  locale: Locale
  onCountsUpdate?: (totalRecords: number, filteredRecords?: number) => void
  onPriceRangeUpdate?: (priceRange: { minPrice: number; maxPrice: number }) => void
  filters?: StoreFilterState // Receive filters from parent wrapper
}

export default function StorePageClient({ locale, onCountsUpdate, onPriceRangeUpdate, filters: parentFilters }: StorePageClientProps) {
  // React 19 useTransition for non-blocking filter operations
  const [isPending, startTransition] = useTransition()

  const { products } = useStore()
  const t = useTranslations('modules.store')
  const [items, setItems] = useState<any[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [filteredRecords, setFilteredRecords] = useState<number | undefined>(undefined)
  const [lastVisible, setLastVisible] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [priceRange, setPriceRange] = useState<{ minPrice: number; maxPrice: number } | null>(null)
  const { ref, inView } = useInView({ rootMargin: '200px', skip: !hasMore })
  
  // Use shared default filters constant
  const filters = useMemo(() => parentFilters || DEFAULT_STORE_FILTERS, [parentFilters])

  // Debounce timer for price range slider
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [debouncedFilters, setDebouncedFilters] = useState(() => filters)

  // Stable refs to avoid effect loops and stale closures
  const loadingRef = useRef(loading)
  const hasMoreRef = useRef(hasMore)
  const inFlightRef = useRef(false)
  const hasInitializedRef = useRef(false) // NEW: Track if we've initialized once
  const errorCountRef = useRef(0) // Track consecutive errors for backoff
  const lastErrorTimeRef = useRef(0) // Track last error time
  const debouncedFiltersRef = useRef(debouncedFilters) // Ref for stable callback
  const lastQueryStringRef = useRef<string | null>(null) // Prevent duplicate loads
  useEffect(() => { loadingRef.current = loading }, [loading])
  useEffect(() => { hasMoreRef.current = hasMore }, [hasMore])
  useEffect(() => { debouncedFiltersRef.current = debouncedFilters }, [debouncedFilters])

  // Initialize with products from context ONCE on mount only
  // CRITICAL: items.length was causing "loop of doom" - repopulating on empty filter results!
  useEffect(() => {
    if (!hasInitializedRef.current) {
      const initial = Array.isArray(products) ? products : []
      if (initial.length > 0) {
        setItems(initial)
        hasInitializedRef.current = true // Mark as initialized
        console.log('🎬 Initial products loaded:', initial.length)
      }
    }
  }, [products]) // FIXED: Removed items.length dependency!

  // Debounced filter updates (750ms delay for slider - Emperor's command!)
  // FIXED: Single debounce effect - removed duplicate immediate update that was causing loops
  useEffect(() => {
    // Skip if filters haven't actually changed (reference equality check)
    const filtersJson = JSON.stringify(filters)
    const debouncedJson = JSON.stringify(debouncedFilters)
    if (filtersJson === debouncedJson) {
      return
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      startTransition(() => {
        console.log('⏱️ Debounce complete! Updating filters:', filters)
        setDebouncedFilters(filters)
      })
    }, 750)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [filters, debouncedFilters])

  // Build query string from debounced filters
  const queryString = useMemo(() => {
    const p = new URLSearchParams()
    p.set('limit', '24')
    
    if (debouncedFilters.search) p.set('search', debouncedFilters.search)
    if (debouncedFilters.categories.length > 0) p.set('categories', debouncedFilters.categories.join(','))
    if (debouncedFilters.priceMin > 0) p.set('priceMin', debouncedFilters.priceMin.toString())
    // Always include priceMax if it's set (don't hardcode comparison value)
    if (debouncedFilters.priceMax) p.set('priceMax', debouncedFilters.priceMax.toString())
    if (debouncedFilters.inStock !== null) p.set('inStock', String(debouncedFilters.inStock))
    if (debouncedFilters.sortBy) p.set('sortBy', debouncedFilters.sortBy)
    
    return p.toString()
  }, [debouncedFilters])

  // Load products page - uses ref for filters to avoid callback recreation
  const loadPage = useCallback(async (reset: boolean, afterId: string | null) => {
    if (loadingRef.current || inFlightRef.current || (!reset && !hasMoreRef.current)) return
    
    // Exponential backoff: prevent request storms after errors
    const now = Date.now()
    const timeSinceLastError = now - lastErrorTimeRef.current
    const backoffDelay = Math.min(1000 * Math.pow(2, errorCountRef.current), 30000) // Max 30s
    
    if (errorCountRef.current > 0 && timeSinceLastError < backoffDelay) {
      console.warn(`⏸️ Backoff: waiting ${backoffDelay}ms after ${errorCountRef.current} errors`)
      return
    }
    
    setLoading(true)
    inFlightRef.current = true
    try {
      // Use server action instead of API route
      // FIXED: Use ref to avoid callback recreation on filter changes
      const currentFilters = debouncedFiltersRef.current
      const { getStoreProducts } = await import('@/app/_actions/store-products')
      const data = await getStoreProducts({
        ...currentFilters,
        limit: 24,
        afterId: afterId || undefined
      })

      if (!data.success) {
        throw new Error(data.error || 'Failed to load products')
      }

      // Reset error count on success
      errorCountRef.current = 0
      lastErrorTimeRef.current = 0

      const newItems = Array.isArray(data.items) ? data.items : []

      // Update items
      console.log('📦 Setting items:', reset ? 'RESET' : 'APPEND', 'New items count:', newItems.length)
      setItems(prev => (reset ? newItems : [...prev, ...newItems]))

      // Update counts - CRITICAL: Use data.total (total in DB), not items.length!
      const dbTotal = data.total !== undefined ? data.total : newItems.length
      const dbFiltered = data.filteredTotal

      console.log('📊 Counts from server action:', { total: dbTotal, filteredTotal: dbFiltered })

      setTotalRecords(dbTotal)
      setFilteredRecords(dbFiltered)
      
      // Update price range from server response (Phase 1 implementation)
      if (data.priceRange) {
        setPriceRange(data.priceRange)
        onPriceRangeUpdate?.(data.priceRange)  // Notify parent
        console.log('💰 Price range from DB:', data.priceRange)
      }
      
      // onCountsUpdate called by useEffect below to prevent double updates
      
      const nextCursor = data.lastVisible || null
      if (!nextCursor || (!reset && nextCursor === afterId) || newItems.length === 0) {
        setHasMore(false)
      }
      setLastVisible(nextCursor)
    } catch (err) {
      // Exponential backoff: increment error count and record time
      errorCountRef.current++
      lastErrorTimeRef.current = Date.now()
      console.error(`❌ Load error (attempt ${errorCountRef.current}):`, err)
      
      // Stop pagination after too many errors
      if (errorCountRef.current >= 5) {
        setHasMore(false)
        console.error('🛑 Too many errors, stopping pagination')
      }
    } finally {
      setLoading(false)
      inFlightRef.current = false
    }
  }, [onPriceRangeUpdate]) // FIXED: Removed debouncedFilters and unnecessary onCountsUpdate dep

  // Reload products when debounced filters change
  // FIXED: Added duplicate prevention using lastQueryStringRef
  useEffect(() => {
    // Skip if query string hasn't changed (prevents duplicate loads)
    if (lastQueryStringRef.current === queryString) {
      return
    }
    lastQueryStringRef.current = queryString
    
    console.log('Query string changed, reloading products:', queryString)
    setLastVisible(null)
    setHasMore(true)
    void loadPage(true, null)
  }, [queryString, loadPage])

  // Load more on scroll
  useEffect(() => {
    if (inView && lastVisible && !loading && hasMore) {
      void loadPage(false, lastVisible)
    }
  }, [inView, lastVisible, loading, hasMore, loadPage])

  // Determine if filters are active
  const hasActiveFilters = filters.search !== '' || 
                          filters.categories.length > 0 || 
                          filters.priceMin > 0 || 
                          (filters.priceMax !== null && filters.priceMax !== undefined) || // Any custom priceMax
                          filters.inStock !== null

  // Notify parent wrapper about count updates
  useEffect(() => {
    onCountsUpdate?.(totalRecords, hasActiveFilters ? filteredRecords : undefined)
  }, [totalRecords, filteredRecords, hasActiveFilters, onCountsUpdate])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
      </div>
      
      {/* Products Grid - Show pending state when loading initial data */}
      {loading && items.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="border rounded-lg p-4 animate-pulse">
              <div className="w-full h-48 bg-muted rounded mb-4"></div>
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map(p => (
            <ProductCard key={p.id} product={p} locale={locale} />
          ))}
        </div>
      )}
      
      {/* Loading indicator for pagination */}
      {loading && items.length > 0 && (
        <div className="flex justify-center py-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
            <span className="text-sm">{t('loading')}</span>
          </div>
        </div>
      )}
      <div ref={ref} className="h-10" />
    </div>
  )
}
