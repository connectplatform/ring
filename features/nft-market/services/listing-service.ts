// NFT Market Listing Service - Database abstraction layer
// Uses ring-db *Doc methods (createDoc, queryDocs, readDoc, updateDoc)

import { auth } from '@/auth'
import { db } from '@/lib/database'

interface CreateListingData {
  sellerUsername: string
  item: {
    address: string
    tokenId: string
    standard: 'ERC721' | 'ERC1155'
    chainId: number
  }
  price: {
    amount: string
    currency: string
  }
}

interface CreateListingResult {
  success: boolean
  id?: string
  error?: string
}

interface GetListingsResult {
  success: boolean
  data?: Record<string, unknown>[]
  error?: string
}

export async function createListingDraft(data: CreateListingData): Promise<CreateListingResult> {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    const { item, price } = data

    if (!item?.address || !item?.tokenId || !item?.standard) {
      return {
        success: false,
        error: 'Invalid item - address, tokenId, and standard are required',
      }
    }

    if (!price?.amount || !price?.currency) {
      return {
        success: false,
        error: 'Invalid price - amount and currency are required',
      }
    }

    const now = new Date()

    const listingData = {
      seller_id: session.user.id,
      token_id: item.tokenId,
      contract_address: item.address,
      token_standard: item.standard,
      name: null,
      description: null,
      price: price.amount,
      currency: price.currency,
      status: 'draft',
      created_at: now,
      updated_at: now,
    }

    const createResult = await db().createDoc('nft_listings', listingData)
    if (!createResult.success || !createResult.data) {
      return {
        success: false,
        error: 'Failed to create NFT listing',
      }
    }

    return {
      success: true,
      id: createResult.data.id,
    }
  } catch (error) {
    console.error('Error creating listing draft:', error)
    return {
      success: false,
      error: 'Failed to create listing draft',
    }
  }
}

export async function getListings(
  filters: {
    username?: string
    status?: string
    limit?: number
  } = {}
): Promise<GetListingsResult> {
  try {
    const { username, status = 'active', limit = 12 } = filters

    const queryFilters = [{ field: 'status', operator: '==' as const, value: status }]

    if (username) {
      console.warn('Username filtering for NFT listings not yet implemented in PostgreSQL migration')
    }

    const clampedLimit = Math.max(1, Math.min(100, limit))

    const queryResult = await db().queryDocs({
      collection: 'nft_listings',
      filters: queryFilters,
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      pagination: { limit: clampedLimit },
    })

    if (!queryResult.success) {
      return {
        success: false,
        error: 'Failed to query NFT listings',
      }
    }

    return {
      success: true,
      data: queryResult.data as Record<string, unknown>[],
    }
  } catch (error) {
    console.error('Error fetching listings:', error)
    return {
      success: false,
      error: 'Failed to fetch listings',
    }
  }
}

export async function getUserActiveListings(username: string, limit = 12): Promise<GetListingsResult> {
  return getListings({ username, status: 'active', limit })
}

export async function activateListing(listingId: string, txHash: string): Promise<CreateListingResult> {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    const listingResult = await db().readDoc('nft_listings', listingId)

    if (!listingResult.success || !listingResult.data) {
      return {
        success: false,
        error: 'Listing not found',
      }
    }

    const listingData = listingResult.data

    if (listingData.seller_user_id !== session.user.id && listingData.seller_id !== session.user.id) {
      return {
        success: false,
        error: 'Not authorized to activate this listing',
      }
    }

    const updateResult = await db().updateDoc('nft_listings', listingId, {
      status: 'active',
      tx_hash: txHash,
      activated_at: new Date(),
      updated_at: new Date(),
    })

    if (!updateResult.success) {
      return {
        success: false,
        error: 'Failed to update listing',
      }
    }

    return {
      success: true,
      id: listingId,
    }
  } catch (error) {
    console.error('Error activating listing:', error)
    return {
      success: false,
      error: 'Failed to activate listing',
    }
  }
}
