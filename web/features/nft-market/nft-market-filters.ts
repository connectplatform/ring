import type { NftMarketListingFilters } from '@/features/nft-market/types'

/**
 * URL/query filter shape for NFT Exhibition market.
 * Server + client safe (no 'use client') — same SSOT pattern as `lib/store-constants.ts`.
 */
export type NftMarketFilters = {
  q: string
  collection: string
  slug: string
  lane?: '' | 'keys' | 'member'
  sort: NonNullable<NftMarketListingFilters['sort']>
}

export const DEFAULT_NFT_MARKET_FILTERS: NftMarketFilters = {
  q: '',
  collection: '',
  slug: '',
  lane: '',
  sort: 'newest',
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

/** Normalize sort query aliases to listing-query sort keys. */
export function normalizeNftMarketSort(sort?: string | null): NftMarketFilters['sort'] {
  if (sort === 'oldest' || sort === 'price_asc' || sort === 'price_desc') return sort
  if (sort === 'price-asc') return 'price_asc'
  if (sort === 'price-desc') return 'price_desc'
  return 'newest'
}

/** FloatingButtons / store-style sort tokens (`price-asc`) ↔ market sort keys. */
export function toFloatingNftMarketSort(sort: NftMarketFilters['sort']) {
  if (sort === 'price_asc') return 'price-asc'
  if (sort === 'price_desc') return 'price-desc'
  return sort
}

/** Parse Next.js searchParams into market filters (Server Component safe). */
export function parseNftMarketSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): NftMarketFilters {
  const laneRaw = firstParam(searchParams.lane)?.trim() || ''
  return {
    q: firstParam(searchParams.q)?.trim() || '',
    collection: firstParam(searchParams.collection)?.trim() || '',
    slug: firstParam(searchParams.slug)?.trim() || '',
    lane: laneRaw === 'keys' || laneRaw === 'member' ? laneRaw : '',
    sort: normalizeNftMarketSort(firstParam(searchParams.sort)),
  }
}
