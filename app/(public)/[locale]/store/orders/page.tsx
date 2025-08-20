"use client"
import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { Locale } from '@/i18n-config'
import { useInView } from '@/hooks/use-intersection-observer'

export default function MyOrdersPage({ params }: { params: { locale: Locale } }) {
  const [items, setItems] = useState<any[]>([])
  const [lastVisible, setLastVisible] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { ref, inView } = useInView({ rootMargin: '200px' })

  const load = useCallback(async (reset = false) => {
    if (loading) return
    setLoading(true)
    try {
      const url = `/api/store/orders?limit=20${!reset && lastVisible ? `&afterId=${lastVisible}` : ''}`
      const res = await fetch(url, { cache: 'no-store' })
      const data = res.ok ? await res.json() : { items: [] }
      setItems(prev => reset ? (data.items || []) : [...prev, ...(data.items || [])])
      setLastVisible(data.lastVisible || null)
    } finally {
      setLoading(false)
    }
  }, [lastVisible, loading])

  const hasInitializedRef = useRef(false)
  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true
      void load(true)
    }
  }, [load])
  useEffect(() => { if (inView && lastVisible && !loading) void load(false) }, [inView, lastVisible, loading, load])

  return (
    <div data-locale={params.locale}
    >
      <h1 className="text-2xl font-semibold mb-4">My Orders</h1>
      {items.length === 0 ? (
        <div className="text-muted-foreground">{loading ? 'Loading…' : 'No orders yet.'}</div>
      ) : (
        <div className="space-y-2">
          {items.map((o: any) => (
            <div key={o.id} className="border rounded p-3">
              <div className="font-medium">Order #{o.id}</div>
              <div className="text-sm text-muted-foreground">Status: {o.status || 'new'}</div>
              <div className="text-sm">Created: {o.createdAt}</div>
            </div>
          ))}
          <div ref={ref} className="h-10" />
        </div>
      )}
    </div>
  )
}


