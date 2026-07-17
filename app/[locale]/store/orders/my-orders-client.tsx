'use client'

import React, { use, useCallback, useMemo } from 'react'
import type { Locale } from '@/i18n/shared'
import StoreWrapper from '@/components/wrappers/store-wrapper'
import { useCursorFeed } from '@/hooks/use-cursor-feed'
import { buildFilterFingerprint } from '@/lib/pagination/filter-fingerprint'
import { normalizePaginatedResponse } from '@/lib/pagination/normalize-paginated-response'

type OrderRow = {
  id: string
  status?: string
  createdAt?: string
}

export default function MyOrdersClient({ params }: { params: Promise<{ locale: Locale }> }) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale
  const limit = 20

  const filterFingerprint = useMemo(
    () => buildFilterFingerprint('my-orders', { scope: 'buyer' }),
    [],
  )

  const fetchPage = useCallback(async (cursor: string | null) => {
    const url = `/api/store/orders?limit=${limit}${cursor ? `&startAfter=${encodeURIComponent(cursor)}&afterId=${encodeURIComponent(cursor)}` : ''}`
    const res = await fetch(url, { cache: 'no-store' })
    const data = res.ok ? await res.json() : { items: [] }
    return normalizePaginatedResponse<OrderRow>(
      {
        items: data.items || [],
        lastVisible: data.lastVisible,
        cursor: data.cursor ?? data.lastVisible,
        hasMore: data.hasMore,
      },
      limit,
    )
  }, [])

  const { items, loading, hasMore, sentinelRef, error } = useCursorFeed<OrderRow>({
    moduleId: 'my-orders',
    locale,
    limit,
    filterFingerprint,
    initialItems: [],
    initialCursor: null,
    fetchPage,
  })

  return (
    <StoreWrapper locale={locale}>
      <div data-locale={locale}>
        <h1 className="text-2xl font-semibold mb-4">My Orders</h1>
        {error && <div className="mb-4 text-sm text-destructive">{error}</div>}
        {items.length === 0 ? (
          <div className="text-muted-foreground">{loading ? 'Loading…' : 'No orders yet.'}</div>
        ) : (
          <div className="space-y-2">
            {items.map((o) => (
              <div key={o.id} className="border rounded p-3">
                <div className="font-medium">Order #{o.id}</div>
                <div className="text-sm text-muted-foreground">Status: {o.status || 'new'}</div>
                <div className="text-sm">Created: {o.createdAt}</div>
              </div>
            ))}
            {loading && items.length > 0 && (
              <div className="py-4 text-center text-sm text-muted-foreground">Loading…</div>
            )}
            {hasMore && <div ref={sentinelRef} className="h-10" aria-hidden />}
          </div>
        )}
      </div>
    </StoreWrapper>
  )
}
