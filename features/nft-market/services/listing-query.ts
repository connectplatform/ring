import 'server-only'

import { db } from '@/lib/database'
import type { DatabaseFilter, DatabaseOrderBy } from '@/lib/database'
import { computePaginationCursor } from '@/lib/pagination/cursor-pagination'
import type {
  NftMarketCollection,
  NftMarketListing,
  NftMarketListingFilters,
  PaginatedNftMarketListings,
} from '@/features/nft-market/types'

const DEFAULT_LIMIT = 24
const MAX_LIMIT = 100

function clampLimit(limit?: number) {
  if (!Number.isFinite(limit ?? NaN)) return DEFAULT_LIMIT
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit as number)))
}

function orderForSort(sort: NftMarketListingFilters['sort']): DatabaseOrderBy[] {
  switch (sort) {
    case 'oldest':
      return [{ field: 'createdAt', direction: 'asc' }]
    case 'price_asc':
      return [{ field: 'priceRaw', direction: 'asc' }]
    case 'price_desc':
      return [{ field: 'priceRaw', direction: 'desc' }]
    case 'newest':
    default:
      return [{ field: 'createdAt', direction: 'desc' }]
  }
}

export function normalizePaginatedResponse(
  items: NftMarketListing[],
  limit: number,
): PaginatedNftMarketListings {
  const { nextCursor, hasMore } = computePaginationCursor(items, limit, (item) => item.id)
  return {
    items,
    cursor: nextCursor,
    nextCursor,
    hasMore,
  }
}

async function resolveSellerUserIdFromUsername(username: string): Promise<string | null> {
  const normalized = username.trim().replace(/^@/, '').toLowerCase()
  if (!normalized) return null

  const usernameRow = await db().findDocById<{ userId?: string; confirmed?: boolean }>(
    'usernames',
    normalized,
  )
  if (usernameRow.success && usernameRow.data?.userId) {
    return usernameRow.data.userId
  }

  const users = await db().queryDocs<{ id: string; username?: string; ringUsername?: string }>({
    collection: 'users',
    filters: [{ field: 'username', operator: '==', value: normalized }],
    pagination: { limit: 1 },
  })
  return users.success ? users.data?.[0]?.id ?? null : null
}

async function startAfterOffset(
  startAfter: string | undefined,
  filters: DatabaseFilter[],
  orderBy: DatabaseOrderBy[],
): Promise<number> {
  if (!startAfter) return 0

  // Correct cursor math must use the same filters/order as the page query.
  // Cap the scan window; beyond this, clients should tighten filters.
  const before = await db().queryDocs<NftMarketListing>({
    collection: 'nft_listings',
    filters,
    orderBy,
    pagination: { limit: 2000 },
  })
  if (!before.success || !before.data) return 0
  const idx = before.data.findIndex((item) => item.id === startAfter)
  return idx >= 0 ? idx + 1 : 0
}

export async function getNftMarketListings(
  filters: NftMarketListingFilters = {},
): Promise<PaginatedNftMarketListings> {
  const limit = clampLimit(filters.limit)
  const queryFilters: DatabaseFilter[] = [
    { field: 'chainFamily', operator: '==', value: 'solana' },
    { field: 'status', operator: '==', value: filters.status ?? 'active' },
  ]

  if (filters.collection) {
    queryFilters.push({ field: 'collection', operator: '==', value: filters.collection })
  }
  if (filters.collectionId) {
    queryFilters.push({ field: 'collectionId', operator: '==', value: filters.collectionId })
  }
  if (filters.lane) {
    queryFilters.push({ field: 'lane', operator: '==', value: filters.lane })
  }
  if (filters.slug) {
    queryFilters.push({ field: 'slug', operator: '==', value: filters.slug })
  }
  if (filters.sellerUserId) {
    queryFilters.push({ field: 'sellerUserId', operator: '==', value: filters.sellerUserId })
  }
  if (filters.sellerUsername) {
    const sellerUserId = await resolveSellerUserIdFromUsername(filters.sellerUsername)
    if (!sellerUserId) return normalizePaginatedResponse([], limit)
    queryFilters.push({ field: 'sellerUserId', operator: '==', value: sellerUserId })
  }
  if (filters.q?.trim()) {
    queryFilters.push({ field: 'searchText', operator: 'ilike', value: `%${filters.q.trim()}%` })
  }

  const orderBy = orderForSort(filters.sort)
  const offset = await startAfterOffset(filters.startAfter, queryFilters, orderBy)
  const result = await db().queryDocs<NftMarketListing>({
    collection: 'nft_listings',
    filters: queryFilters,
    orderBy,
    pagination: { limit, offset },
  })

  if (!result.success || !result.data) {
    return normalizePaginatedResponse([], limit)
  }

  return normalizePaginatedResponse(result.data, limit)
}

export async function getNftMarketCollections(limit = 48): Promise<NftMarketCollection[]> {
  const result = await db().queryDocs<NftMarketCollection>({
    collection: 'nft_market_collections',
    orderBy: [{ field: 'activeListings', direction: 'desc' }],
    pagination: { limit: Math.max(1, Math.min(100, Math.floor(limit))) },
  })

  if (!result.success || !result.data) return []
  return result.data
}

export async function getNftMarketCollectionBySlugOrId(
  slugOrId: string,
): Promise<NftMarketCollection | null> {
  const idResult = await db().readDoc<NftMarketCollection>('nft_market_collections', slugOrId)
  if (idResult.success && idResult.data) return idResult.data

  const bySlug = await db().queryDocs<NftMarketCollection>({
    collection: 'nft_market_collections',
    filters: [{ field: 'slug', operator: '==', value: slugOrId }],
    pagination: { limit: 1 },
  })
  if (bySlug.success && bySlug.data?.[0]) return bySlug.data[0]

  const byCollection = await db().queryDocs<NftMarketCollection>({
    collection: 'nft_market_collections',
    filters: [{ field: 'collection', operator: '==', value: slugOrId }],
    pagination: { limit: 1 },
  })
  if (byCollection.success && byCollection.data?.[0]) return byCollection.data[0]

  // Member creator collections may not yet have a market cache row.
  const member = await db().readDoc<{
    id: string
    collectionMint?: string
    name?: string
    symbol?: string
    uri?: string
    imageUri?: string
    creatorUserId?: string
    mintCount?: number
  }>('nft_member_collections', slugOrId)
  if (member.success && member.data) {
    return {
      id: member.data.id,
      collection: member.data.collectionMint || member.data.id,
      slug: member.data.id,
      name: member.data.name || 'Member collection',
      symbol: member.data.symbol || 'MEMBER',
      uri: member.data.uri,
      imageUri: member.data.imageUri,
      activeListings: 0,
      itemCount: member.data.mintCount || 0,
      creatorUserId: member.data.creatorUserId,
      lane: 'member',
      updatedAt: new Date().toISOString(),
    }
  }

  return null
}
