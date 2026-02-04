// NFT Market Listing Service - Database abstraction layer
// Migrated to use PostgreSQL for NFT listings storage

import { auth } from '@/auth'
import { getDatabaseService, initializeDatabase } from '@/lib/database'

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
    const session = await auth()
    
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

    // Initialize database service
    const initResult = await initializeDatabase()
    if (!initResult.success) {
      return {
        success: false,
        error: 'Database initialization failed'
      }
    }

    const dbService = getDatabaseService()
    const now = new Date()

    // Create draft listing data for nft_listings table
    const listingData = {
      seller_id: session.user.id,
      token_id: item.tokenId,
      contract_address: item.address,
      token_standard: item.standard,
      name: null, // Will be filled later
      description: null, // Will be filled later
      price: price.amount,
      currency: price.currency,
      status: 'draft',
      created_at: now,
      updated_at: now
    }

    // Create the listing in database
    const createResult = await dbService.create('nft_listings', listingData)
    if (!createResult.success) {
      return {
        success: false,
        error: 'Failed to create NFT listing'
      }
    }

    return {
      success: true,
      id: createResult.data.id
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

    // Initialize database service
    const initResult = await initializeDatabase()
    if (!initResult.success) {
      return {
        success: false,
        error: 'Database initialization failed'
      }
    }

    const dbService = getDatabaseService()

    // Build query filters
    const queryFilters = [{ field: 'status', operator: '==' as const, value: status }]

    // Note: For PostgreSQL, username filtering would require joining with users table
    // For now, we'll skip username filtering or implement it differently
    if (username) {
      // This would need a more complex query joining users and nft_listings tables
      // For simplicity, we'll skip username filtering for now
      console.warn('Username filtering for NFT listings not yet implemented in PostgreSQL migration')
    }

    const clampedLimit = Math.max(1, Math.min(100, limit))

    // Query NFT listings
    const queryResult = await dbService.query({
      collection: 'nft_listings',
      filters: queryFilters,
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      pagination: { limit: clampedLimit }
    })

    if (!queryResult.success) {
      return {
        success: false,
        error: 'Failed to query NFT listings'
      }
    }

    // Convert database documents to expected format
    const data = queryResult.data.map(doc => ({
      id: doc.id,
      seller_id: doc.data?.seller_id,
      token_id: doc.data?.token_id,
      contract_address: doc.data?.contract_address,
      token_standard: doc.data?.token_standard,
      name: doc.data?.name,
      description: doc.data?.description,
      image_url: doc.data?.image_url,
      price: doc.data?.price,
      currency: doc.data?.currency,
      status: doc.data?.status,
      created_at: doc.data?.created_at,
      updated_at: doc.data?.updated_at,
      ...doc.data
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
    const session = await auth()
    
    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    // Initialize database service
    const initResult = await initializeDatabase();
    if (!initResult.success) {
      return {
        success: false,
        error: 'Database initialization failed'
      };
    }

    const dbService = getDatabaseService();

    // Read the listing
    const listingResult = await dbService.read('nft_listings', listingId);

    if (!listingResult.success || !listingResult.data) {
      return {
        success: false,
        error: 'Listing not found'
      };
    }

    const listingData = listingResult.data.data || listingResult.data;

    // Check if user owns the listing
    if (listingData?.seller_user_id !== session.user.id) {
      return {
        success: false,
        error: 'Not authorized to activate this listing'
      };
    }

    // Activate the listing
    const updatedListingData = {
      ...listingData,
      status: 'active',
      tx_hash: txHash,
      activated_at: new Date(),
      updated_at: new Date()
    };

    const updateResult = await dbService.update('nft_listings', listingId, updatedListingData);
    if (!updateResult.success) {
      return {
        success: false,
        error: 'Failed to update listing'
      };
    }

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
