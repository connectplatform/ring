import { cache } from 'react'
import { db } from '@/lib/database'
import type { Listing } from '../types'

/**
 * Fetch user's active NFT listings by username
 * READ operation - uses React 19 cache() for performance
 */
export const fetchUserActiveListingsByUsername = cache(async (username: string, limit = 12): Promise<Listing[]> => {
  const result = await db().queryDocs({
    collection: 'nft_listings',
    filters: [
      { field: 'sellerUsername', operator: '==', value: username },
      { field: 'status', operator: '==', value: 'active' },
    ],
    pagination: { limit },
  })

  if (!result.success) {
    console.error('Failed to fetch user listings:', result.error)
    return []
  }

  return result.data as unknown as Listing[]
})

/**
 * Fetch NFT collection listings by slug or address
 * READ operation - uses React 19 cache() for performance
 */
export const fetchCollectionListings = cache(async (slugOrAddress: string, limit = 24): Promise<Listing[]> => {
  const result = await db().queryDocs({
    collection: 'nft_listings',
    filters: [
      { field: 'item.slug', operator: '==', value: slugOrAddress },
      { field: 'status', operator: '==', value: 'active' },
    ],
    pagination: { limit },
  })

  if (!result.success) {
    console.error('Failed to fetch collection listings:', result.error)
    return []
  }

  return result.data as unknown as Listing[]
})
