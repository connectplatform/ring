"use client"
import React, { useCallback, useEffect, useRef, useState, use } from 'react'
import type { Locale } from '@/i18n/shared'
import { useInView } from '@/hooks/use-intersection-observer'
import StoreWrapper from '@/components/wrappers/store-wrapper'

export default function MyOrdersClient({ params }: { params: Promise<{ locale: Locale }> }) {
  // Suspense for data loading: using React's experimental `use` for async params
  // TODO: When Next.js 16+ implements more stable async route params, prefer that pattern.
  const resolvedParams = use(params)
  const locale = resolvedParams.locale

  // State for orders, pagination, and loading
  const [items, setItems] = useState<any[]>([]) // Holds fetched order items
  const [lastVisible, setLastVisible] = useState<string | null>(null) // Indicates the last order fetched, for pagination
  const [loading, setLoading] = useState(false) // True while fetching

  // Infinite scroll hook from custom intersection observer
  // inView - is the sentinel in viewport?
  // ref - sentinel element for trigger
  const { ref, inView } = useInView({ rootMargin: '200px' })

  // Loads orders (initial or next page)
  // Uses lastVisible to indicate pagination, and only acts if not already loading
  const load = useCallback(async (reset = false) => {
    if (loading) return // Guard: skip fetch if already loading
    setLoading(true)
    try {
      // Condition the fetch URL to pass afterId if paginating further
      const url = `/api/store/orders?limit=20${!reset && lastVisible ? `&afterId=${lastVisible}` : ''}`
      const res = await fetch(url, { cache: 'no-store' })
      // If failed, return empty orders (TODO: surface error UI if needed)
      const data = res.ok ? await res.json() : { items: [] }
      // If reset (initial load), replace. Else, append.
      setItems(prev => reset ? (data.items || []) : [...prev, ...(data.items || [])])
      setLastVisible(data.lastVisible || null) // For next pagination, null if no more data
    } finally {
      setLoading(false) // Always clear loading state
    }
  }, [lastVisible, loading])

  // Only run load(true) on first component mount (tracks with a ref)
  // TODO: Use React.startTransition if switching to concurrent mode, for better scheduling.
  const hasInitializedRef = useRef(false)
  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true
      void load(true) // Initial load, reset items
    }
  }, [load])

  // Trigger load for next page when sentinel is in view and there is more data to fetch
  useEffect(() => {
    if (inView && lastVisible && !loading)
      void load(false)
  }, [inView, lastVisible, loading, load])

  return (
    <StoreWrapper locale={locale}>
      <div data-locale={locale}>
        <h1 className="text-2xl font-semibold mb-4">My Orders</h1>
        {/* If no items, either loading, or display empty state */}
        {items.length === 0 ? (
          <div className="text-muted-foreground">{loading ? 'Loading…' : 'No orders yet.'}</div>
        ) : (
          <div className="space-y-2">
            {/* Render order cards */}
            {items.map((o: any) => (
              <div key={o.id} className="border rounded p-3">
                {/* Display order primary info */}
                <div className="font-medium">Order #{o.id}</div>
                <div className="text-sm text-muted-foreground">Status: {o.status || 'new'}</div>
                <div className="text-sm">Created: {o.createdAt}</div>
              </div>
            ))}
            {/* Sentinel div for intersection observer: triggers loading next page when visible */}
            <div ref={ref} className="h-10" />
          </div>
        )}
      </div>
    </StoreWrapper>
  )
}
