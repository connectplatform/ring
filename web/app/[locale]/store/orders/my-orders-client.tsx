'use client'

import React, { use, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import { cn } from '@/lib/utils'
import { davinciBeamInnerSurface, davinciGlassSurface } from '@/lib/ui/davinci'
import { useCursorFeed } from '@/hooks/use-cursor-feed'
import { buildFilterFingerprint } from '@/lib/pagination/filter-fingerprint'
import { normalizePaginatedResponse } from '@/lib/pagination/normalize-paginated-response'
import { readBuyerShipment, readOpportunityOffer, type OpportunityOffer } from '@/features/store/lib/order-dashboard'

const INSET = 'px-4 sm:px-5 lg:px-6'
const BAND_Y = 'py-12 sm:py-14 lg:py-16'

const STATUS_LABEL = {
  new: 'statuses.new',
  paid: 'statuses.paid',
  processing: 'statuses.processing',
  shipped: 'statuses.shipped',
  delivered: 'statuses.delivered',
  completed: 'statuses.completed',
  canceled: 'statuses.canceled',
  cancelled: 'statuses.cancelled',
} as const

type OrderRow = {
  id: string
  status?: string
  createdAt?: string
  total?: number
  shipments?: unknown
  shipment?: unknown
}

export default function MyOrdersClient({ params }: { params: Promise<{ locale: Locale }> }) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale
  const t = useTranslations('modules.store.myOrders')
  const limit = 20
  const [needsAuth, setNeedsAuth] = useState(false)
  const [offers, setOffers] = useState<OpportunityOffer[]>([])

  const filterFingerprint = useMemo(
    () => buildFilterFingerprint('my-orders', { scope: 'buyer' }),
    [],
  )

  const fetchPage = useCallback(async (cursor: string | null) => {
    const url = `/api/store/orders?limit=${limit}${cursor ? `&startAfter=${encodeURIComponent(cursor)}&afterId=${encodeURIComponent(cursor)}` : ''}`
    const res = await fetch(url, { cache: 'no-store' })
    if (res.status === 401) {
      setNeedsAuth(true)
      return normalizePaginatedResponse<OrderRow>({ items: [], lastVisible: null, hasMore: false }, limit)
    }
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

  const { items, setItems, loading, hasMore, sentinelRef, error } = useCursorFeed<OrderRow>({
    moduleId: 'my-orders',
    locale,
    limit,
    filterFingerprint,
    initialItems: [],
    initialCursor: null,
    fetchPage,
  })

  const refresh = useCallback(async () => {
    const page = await fetchPage(null)
    setItems((current) => {
      if (!page.items.length) return current
      const fresh = new Map(page.items.map((item) => [item.id, item]))
      const merged = current.map((item) => fresh.get(item.id) ?? item)
      const seen = new Set(merged.map((item) => item.id))
      return [...page.items.filter((item) => !seen.has(item.id)), ...merged]
    })
  }, [fetchPage, setItems])

  useEffect(() => {
    const handle = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void refresh()
    }, 20000)
    return () => window.clearInterval(handle)
  }, [refresh])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(
          '/api/opportunities/search?types=collective_order,vendor_listing&limit=8&sortBy=dateCreated&sortOrder=desc',
          { cache: 'no-store' },
        )
        if (!res.ok) return
        const data = await res.json()
        const rows = Array.isArray(data.opportunities) ? data.opportunities : []
        const parsed = rows
          .map((row: unknown) => readOpportunityOffer(row))
          .filter((row: OpportunityOffer | null): row is OpportunityOffer => Boolean(row))
        if (!cancelled) setOffers(parsed)
      } catch {
        if (!cancelled) setOffers([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const groupBuys = offers.filter((offer) => offer.type === 'collective_order')
  const sales = offers.filter((offer) => offer.type !== 'collective_order')

  return (
    <RingRightRailLayout flushCenterPane showRightRail={false}>
      <DavinciCenterPane contentClassName="!p-0">
        <div className="w-full min-w-0" data-locale={locale}>
          <section className={cn(BAND_Y, 'bg-[color-mix(in_oklch,var(--davinci-beam)_8%,transparent)]')}>
            <div className={cn('w-full', INSET)}>
              <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">{t('title')}</h1>
                  <p className="mt-2 max-w-2xl text-muted-foreground">{t('subtitle')}</p>
                </div>
                <p className="text-xs text-muted-foreground">{t('live')}</p>
              </header>

              <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]">
                <div className="min-w-0 space-y-3">
                  {error ? <div className="text-sm text-destructive">{error}</div> : null}
                  {needsAuth ? (
                    <Link href={ROUTES.LOGIN(locale)} className={cn(davinciGlassSurface, 'block p-4 text-sm')}>
                      {t('signIn')}
                    </Link>
                  ) : null}
                  {!needsAuth && items.length === 0 ? (
                    <div className={cn(davinciGlassSurface, 'p-4 text-muted-foreground')}>
                      {loading ? t('loading') : t('empty')}
                    </div>
                  ) : (
                    items.map((order) => (
                      <OrderCard key={order.id} order={order} locale={locale} />
                    ))
                  )}
                  {loading && items.length > 0 ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">{t('loading')}</div>
                  ) : null}
                  {hasMore ? <div ref={sentinelRef} className="h-10" aria-hidden /> : null}
                </div>

                <aside className="min-w-0 space-y-4">
                  <OfferColumn
                    title={t('groupBuys')}
                    hint={t('groupBuysHint')}
                    empty={t('noOffers')}
                    conditionsLabel={t('conditions')}
                    offers={groupBuys}
                    locale={locale}
                  />
                  <OfferColumn
                    title={t('sales')}
                    hint={t('salesHint')}
                    empty={t('noOffers')}
                    conditionsLabel={t('conditions')}
                    offers={sales}
                    locale={locale}
                  />
                </aside>
              </div>
            </div>
          </section>
        </div>
      </DavinciCenterPane>
    </RingRightRailLayout>
  )
}

function OrderCard({ order, locale }: { order: OrderRow; locale: Locale }) {
  const t = useTranslations('modules.store.myOrders')
  const shipment = readBuyerShipment(order)
  const statusKey = order.status || 'new'
  const labelKey = statusKey in STATUS_LABEL ? STATUS_LABEL[statusKey as keyof typeof STATUS_LABEL] : null
  const statusLabel = labelKey ? t(labelKey) : statusKey
  const placed = order.createdAt ? new Date(order.createdAt).toLocaleString(locale) : ''

  return (
    <article className={cn(davinciGlassSurface, 'p-4')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-foreground">#{order.id}</div>
          {placed ? <div className="text-xs text-muted-foreground">{t('placed')} {placed}</div> : null}
        </div>
        <div className={cn(davinciBeamInnerSurface, 'px-3 py-1 text-sm font-medium tabular-nums')}>
          {t('status')}: {statusLabel}
        </div>
      </div>
      <div className="mt-3 text-sm text-muted-foreground">
        <div>
          {t('shipment')}: {shipment?.status || t('noShipment')}
        </div>
        {shipment?.number ? (
          <div>
            {t('tracking')}: <span className="font-mono text-foreground">{shipment.number}</span>
          </div>
        ) : null}
      </div>
      <Link
        href={ROUTES.STORE_ORDER_DETAILS(locale, order.id)}
        className="mt-3 inline-flex text-sm font-medium text-[var(--davinci-beam)]"
      >
        {t('open')}
      </Link>
    </article>
  )
}

function OfferColumn({
  title,
  hint,
  empty,
  conditionsLabel,
  offers,
  locale,
}: {
  title: string
  hint: string
  empty: string
  conditionsLabel: string
  offers: OpportunityOffer[]
  locale: Locale
}) {
  return (
    <section className={cn(davinciGlassSurface, 'p-4')}>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      {offers.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {offers.map((offer) => (
            <li key={offer.id} className={cn(davinciBeamInnerSurface, 'px-3 py-2')}>
              <Link href={ROUTES.OPPORTUNITY(offer.id, locale)} className="font-medium text-foreground">
                {offer.title}
              </Link>
              {offer.conditions ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {conditionsLabel}: {offer.conditions}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
