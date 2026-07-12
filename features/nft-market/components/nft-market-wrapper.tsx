'use client'

import { useCallback, useMemo, useTransition } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Filter, Search, Store } from 'lucide-react'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import { RingBreadcrumbs } from '@/components/common/ring-breadcrumbs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DavinciGlassPanel } from '@/lib/ui/davinci'
import { useCursorFeed } from '@/hooks/use-cursor-feed'
import { buildFilterFingerprint } from '@/lib/pagination/filter-fingerprint'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import type {
  NftMarketCollection,
  NftMarketListing,
  NftMarketListingFilters,
  PaginatedNftMarketListings,
} from '@/features/nft-market/types'
import { NftListingCard } from './nft-listing-card'

const FloatingButtons = dynamic(() => import('@/components/store/floating-buttons'), { ssr: false })

const PAGE_SIZE = 24

export type NftMarketFilters = {
  q: string
  collection: string
  slug: string
  lane?: '' | 'keys' | 'member'
  sort: NonNullable<NftMarketListingFilters['sort']>
}

export function normalizeNftMarketSort(sort?: string | null): NftMarketFilters['sort'] {
  if (sort === 'oldest' || sort === 'price_asc' || sort === 'price_desc') return sort
  if (sort === 'price-asc') return 'price_asc'
  if (sort === 'price-desc') return 'price_desc'
  return 'newest'
}

function toFloatingSort(sort: NftMarketFilters['sort']) {
  if (sort === 'price_asc') return 'price-asc'
  if (sort === 'price_desc') return 'price-desc'
  return sort
}

function buildUrl(locale: Locale, filters: NftMarketFilters) {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.collection) params.set('collection', filters.collection)
  if (filters.slug) params.set('slug', filters.slug)
  if (filters.lane) params.set('lane', filters.lane)
  if (filters.sort !== 'newest') params.set('sort', filters.sort)
  const query = params.toString()
  return `${ROUTES.NFT_MARKET(locale)}${query ? `?${query}` : ''}`
}

function MarketFiltersRail({
  locale,
  filters,
  collections,
  totalVisible,
  onApply,
}: {
  locale: Locale
  filters: NftMarketFilters
  collections: NftMarketCollection[]
  totalVisible: number
  onApply: (filters: NftMarketFilters) => void
}) {
  return (
    <div className="space-y-4">
      <DavinciGlassPanel>
        <div className="mb-4 flex items-center gap-2">
          <Filter className="h-4 w-4 text-[var(--davinci-beam)]" />
          <h2 className="font-semibold">Marketplace filters</h2>
        </div>
        <form
          className="space-y-4"
          action={(formData) => {
            onApply({
              q: String(formData.get('q') || '').trim(),
              collection: String(formData.get('collection') || ''),
              slug: String(formData.get('slug') || '').trim(),
              lane: (() => {
                const value = String(formData.get('lane') || '')
                return value === 'keys' || value === 'member' ? value : ''
              })(),
              sort: normalizeNftMarketSort(String(formData.get('sort') || 'newest')),
            })
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="nft-market-q">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="nft-market-q" name="q" defaultValue={filters.q} className="pl-9" placeholder="gate, asset, seller..." />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nft-market-collection">Collection</Label>
            <select
              id="nft-market-collection"
              name="collection"
              defaultValue={filters.collection || 'all'}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All collections</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.collection}>
                  {collection.symbol} · {collection.activeListings} listed
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nft-market-lane">Lane</Label>
            <select
              id="nft-market-lane"
              name="lane"
              defaultValue={filters.lane || 'all'}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All lanes</option>
              <option value="keys">KEYS verified</option>
              <option value="member">Member collections</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nft-market-slug">Gate slug</Label>
            <Input id="nft-market-slug" name="slug" defaultValue={filters.slug} placeholder="vendor-store-deed" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nft-market-sort">Sort</Label>
            <select
              id="nft-market-sort"
              name="sort"
              defaultValue={filters.sort}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="price_asc">Price low to high</option>
              <option value="price_desc">Price high to low</option>
            </select>
          </div>

          <Button type="submit" className="w-full">Apply filters</Button>
          <Button asChild type="button" variant="outline" className="w-full">
            <Link href={ROUTES.NFT_MARKET(locale)}>Clear</Link>
          </Button>
        </form>
      </DavinciGlassPanel>

      <DavinciGlassPanel>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Visible listings</span>
          <span className="text-lg font-semibold">{totalVisible}</span>
        </div>
        <Button asChild variant="outline" className="mt-4 w-full">
          <Link href={ROUTES.NFT_MARKET_SELL(locale)}>
            <Store className="mr-2 h-4 w-4" />
            List a KEYS gate
          </Link>
        </Button>
        <Button asChild variant="secondary" className="mt-2 w-full">
          <Link href={ROUTES.NFT_CREATE(locale)}>Create member mint</Link>
        </Button>
      </DavinciGlassPanel>
    </div>
  )
}

export function NftMarketFeed({
  locale,
  filters,
  initialPage,
}: {
  locale: Locale
  filters: NftMarketFilters
  initialPage: PaginatedNftMarketListings
}) {
  const fingerprint = useMemo(
    () => buildFilterFingerprint('nft-market', filters as unknown as Record<string, unknown>),
    [filters],
  )

  const fetchPage = useCallback(
    async (cursor: string | null) => {
      const { getNftMarketListingsAction } = await import('@/app/_actions/nft-market')
      const page = await getNftMarketListingsAction({
        q: filters.q || undefined,
        collection: filters.collection || undefined,
        slug: filters.slug || undefined,
        lane: filters.lane || undefined,
        sort: filters.sort,
        status: 'active',
        limit: PAGE_SIZE,
        startAfter: cursor ?? undefined,
      })
      return {
        items: page.items,
        cursor: page.nextCursor,
        hasMore: page.hasMore,
      }
    },
    [filters],
  )

  const { items, loading, hasMore, error, sentinelRef } = useCursorFeed<NftMarketListing>({
    moduleId: 'nft-market',
    locale,
    limit: PAGE_SIZE,
    filterFingerprint: fingerprint,
    initialItems: initialPage.items,
    initialCursor: initialPage.nextCursor,
    fetchPage,
  })

  if (!loading && items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-card/50 p-10 text-center">
        <p className="text-lg font-medium">No active NFT listings found.</p>
        <p className="mt-2 text-sm text-muted-foreground">Try another search or clear the filters.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((listing) => (
          <NftListingCard key={listing.id} listing={listing} locale={locale} />
        ))}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <div className="flex justify-center py-6 text-sm text-muted-foreground">
          Loading NFT listings...
        </div>
      ) : null}
      {hasMore ? <div ref={sentinelRef} className="h-10" /> : null}
    </div>
  )
}

export function NftMarketWrapper({
  locale,
  initialFilters,
  initialPage,
  collections,
}: {
  locale: Locale
  initialFilters: NftMarketFilters
  initialPage: PaginatedNftMarketListings
  collections: NftMarketCollection[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const normalizedFilters = {
    ...initialFilters,
    collection: initialFilters.collection === 'all' ? '' : initialFilters.collection,
  }

  const applyFilters = useCallback(
    (next: NftMarketFilters) => {
      const normalized = { ...next, collection: next.collection === 'all' ? '' : next.collection }
      startTransition(() => router.replace(buildUrl(locale, normalized)))
    },
    [locale, router],
  )

  const handleSortChange = useCallback(
    (sortBy: string) => {
      applyFilters({ ...normalizedFilters, sort: normalizeNftMarketSort(sortBy) })
    },
    [applyFilters, normalizedFilters],
  )

  const header = (
    <div className="space-y-4">
      <RingBreadcrumbs items={[{ label: 'NFT Exhibition', href: ROUTES.NFT_MARKET(locale) }]} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-primary">Exhibition marketplace</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">NFT Exhibition Marketplace</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Two lanes in one feed: verified KEYS gates (stake after buy) and member-created Metaplex Core collections
            (ownership + RING only). Ledger-dev settlement for PoC.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={ROUTES.NFT_CREATE(locale)}>Create / mint</Link>
          </Button>
          <Button asChild>
            <Link href={ROUTES.NFT_MARKET_SELL(locale)}>Sell KEYS gate</Link>
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <RingRightRailLayout
      flushCenterPane
      rightRailPurpose="nft-market"
      rightRailContent={[{ blockType: 'nft-market-filters' }, { blockType: 'nft-market-sell-cta' }]}
      rightRail={
        <MarketFiltersRail
          locale={locale}
          filters={normalizedFilters}
          collections={collections}
          totalVisible={initialPage.items.length}
          onApply={applyFilters}
        />
      }
    >
      <DavinciCenterPane header={header}>
        <NftMarketFeed locale={locale} filters={normalizedFilters} initialPage={initialPage} />
        <FloatingButtons
          locale={locale}
          showSort
          currentSort={toFloatingSort(normalizedFilters.sort)}
          onSortChange={handleSortChange}
        />
      </DavinciCenterPane>
    </RingRightRailLayout>
  )
}
