'use client'

import { useCallback, useMemo } from 'react'
import { useCursorFeed } from '@/hooks/use-cursor-feed'
import { buildFilterFingerprint } from '@/lib/pagination/filter-fingerprint'
import type { Locale } from '@/i18n/shared'
import { defaultLocale } from '@/i18n/shared'
import type { NftMarketListing, PaginatedNftMarketListings } from '@/features/nft-market/types'
import { NftListingCard } from './nft-listing-card'

export default function ProfileListings({
  username,
  locale = defaultLocale,
  initialPage,
}: {
  username: string
  locale?: Locale
  initialPage: PaginatedNftMarketListings
}) {
  const filterFingerprint = useMemo(
    () => buildFilterFingerprint('nft-market', { sellerUsername: username, scope: 'profile' }),
    [username],
  )

  const fetchPage = useCallback(
    async (cursor: string | null) => {
      const { getNftMarketListingsAction } = await import('@/app/_actions/nft-market')
      const page = await getNftMarketListingsAction({
        sellerUsername: username,
        status: 'active',
        limit: 12,
        startAfter: cursor ?? undefined,
      })
      return {
        items: page.items,
        cursor: page.nextCursor,
        hasMore: page.hasMore,
      }
    },
    [username],
  )

  const { items, loading, error, hasMore, sentinelRef } = useCursorFeed<NftMarketListing>({
    moduleId: 'nft-market',
    locale,
    limit: 12,
    filterFingerprint,
    initialItems: initialPage.items,
    initialCursor: initialPage.nextCursor,
    fetchPage,
    maxCachedItems: 36,
    restoreScroll: false,
  })

  if (!loading && items.length === 0) {
    return <div className="text-sm text-muted-foreground">No active listings</div>
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((listing) => (
          <NftListingCard key={listing.id} listing={listing} locale={locale} />
        ))}
      </div>
      {error ? <div className="text-sm text-destructive">{error}</div> : null}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading listings...</div>
      ) : null}
      {hasMore ? <div ref={sentinelRef} className="h-8" /> : null}
    </div>
  )
}
