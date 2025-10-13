'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Locale } from '@/i18n-config'
import Link from 'next/link'
import { ROUTES } from '@/constants/routes'
import { useStore } from '@/features/store/context'
import { ProductCard } from '@/features/store/components/product-card'
import { useInView } from '@/hooks/use-intersection-observer'
import { useTranslations } from 'next-intl'

export default function StorePageClient({ locale }: { locale: Locale }) {
  const { products } = useStore()
  const t = useTranslations('modules.store')
  const [items, setItems] = useState<any[]>([])
  const [lastVisible, setLastVisible] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const { ref, inView } = useInView({ rootMargin: '200px', skip: !hasMore })

  // Stable refs to avoid effect loops and stale closures
  const loadingRef = useRef(loading)
  const hasMoreRef = useRef(hasMore)
  const inFlightRef = useRef(false)
  useEffect(() => { loadingRef.current = loading }, [loading])
  useEffect(() => { hasMoreRef.current = hasMore }, [hasMore])

  useEffect(() => {
    const initial = Array.isArray(products) ? products : []
    if (items.length === 0 && initial.length > 0) {
      setItems(initial)
    }
    // Let API control pagination cursor; avoid pre-setting lastVisible from initial list
  }, [products, items.length])

  const queryString = useMemo(() => {
    const p = new URLSearchParams()
    p.set('limit', '24')
    return p.toString()
  }, [])

  const loadPage = useCallback(async (reset: boolean, afterId: string | null) => {
    if (loadingRef.current || inFlightRef.current || (!reset && !hasMoreRef.current)) return
    setLoading(true)
    inFlightRef.current = true
    try {
      const after = !reset && afterId ? `&afterId=${encodeURIComponent(afterId)}` : ''
      const url = `/api/store/products?${queryString}${after}`
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load products')
      const data = await res.json()
      const newItems = Array.isArray(data.items) ? data.items : []
      setItems(prev => (reset ? newItems : [...prev, ...newItems]))
      const nextCursor = data.lastVisible || null
      if (!nextCursor || (!reset && nextCursor === afterId) || newItems.length === 0) {
        setHasMore(false)
      }
      setLastVisible(nextCursor)
    } catch (_err) {
      // Stop the loop on errors to avoid request storms
      setHasMore(false)
    } finally {
      setLoading(false)
      inFlightRef.current = false
    }
  }, [queryString])

  useEffect(() => {
    // Avoid clearing items to prevent UI flicker; just refetch page 1
    setLastVisible(null)
    setHasMore(true)
    void loadPage(true, null)
  }, [queryString, loadPage])

  useEffect(() => {
    if (inView && lastVisible && !loading && hasMore) {
      void loadPage(false, lastVisible)
    }
  }, [inView, lastVisible, loading, hasMore, loadPage])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <div className="flex gap-3">
          <Link className="underline" href={ROUTES.CART(locale)}>{t('cart.title')}</Link>
          <Link className="underline" href={ROUTES.CHECKOUT(locale)}>{t('checkout.title')}</Link>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {items.map(p => (
          <ProductCard key={p.id} product={p} locale={locale} />
        ))}
      </div>
      <div ref={ref} className="h-10" />
    </div>
  )
}


