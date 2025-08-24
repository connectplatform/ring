// NFT Market Listing Service - Direct Firestore operations
// Extracted from API routes to follow Ring's architectural pattern:
// "Server Actions should call services directly; avoid HTTP requests to own API routes"

import { getServerAuthSession } from '@/auth'
import { getAdminDb } from '@/lib/firebase-admin.server'

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
  data?: any[]
  error?: string
}

export async function createListingDraft(data: CreateListingData): Promise<CreateListingResult> {
  try {
    const session = await getServerAuthSession()
    
    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    // Validate required fields
    const { item, price, sellerUsername } = data
    
    if (!item?.address || !item?.tokenId || !item?.standard) {
      return {
        success: false,
        error: 'Invalid item - address, tokenId, and standard are required'
      }
    }
    
    if (!price?.amount || !price?.currency) {
      return {
        success: false,
        error: 'Invalid price - amount and currency are required'
      }
    }

    const db = await getAdminDb()
    const col = db.collection('nft_listings')
    const now = new Date()
    
    // Create draft listing
    const draft = await col.add({
      sellerUserId: session.user.id,
      sellerUsername: sellerUsername || session.user.username || null,
      item,
      price,
      status: 'draft',
      createdAt: now,
      updatedAt: now
    })

    return {
      success: true,
      id: draft.id
    }

  } catch (error) {
    console.error('Error creating listing draft:', error)
    return {
      success: false,
      error: 'Failed to create listing draft'
    }
  }
}

export async function getListings(filters: {
  username?: string
  status?: string
  limit?: number
} = {}): Promise<GetListingsResult> {
  try {
    const {
      username,
      status = 'active',
      limit = 12
    } = filters

    const db = await getAdminDb()
    const col = db.collection('nft_listings')
    
    let query = col.where('status', '==', status)
    
    if (username) {
      query = query.where('sellerUsername', '==', username)
    }
    
    const clampedLimit = Math.max(1, Math.min(100, limit))
    const snapshot = await query.limit(clampedLimit).get()
    
    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }))

    return {
      success: true,
      data
    }

  } catch (error) {
    console.error('Error fetching listings:', error)
    return {
      success: false,
      error: 'Failed to fetch listings'
    }
  }
}

export async function getUserActiveListings(username: string, limit = 12): Promise<GetListingsResult> {
  return getListings({ username, status: 'active', limit })
}

export async function activateListing(listingId: string, txHash: string): Promise<CreateListingResult> {
  try {
    const session = await getServerAuthSession()
    
    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    const db = await getAdminDb()
    const listingRef = db.collection('nft_listings').doc(listingId)
    const listing = await listingRef.get()

    if (!listing.exists) {
      return {
        success: false,
        error: 'Listing not found'
      }
    }

    const listingData = listing.data()
    
    // Check if user owns the listing
    if (listingData?.sellerUserId !== session.user.id) {
      return {
        success: false,
        error: 'Not authorized to activate this listing'
      }
    }

    // Activate the listing
    await listingRef.update({
      status: 'active',
      txHash: txHash,
      activatedAt: new Date(),
      updatedAt: new Date()
    })

    return {
      success: true,
      id: listingId
    }

  } catch (error) {
    console.error('Error activating listing:', error)
    return {
      success: false,
      error: 'Failed to activate listing'
    }
  }
}
