/**
 * Store Shipping Address Management (Server-side)
 * 
 * - Uses React 19 cache() for address list read operations for fast SSR and caching.
 * - All DB operations performed via shared PostgreSQL DatabaseService.
 * - ONLY used in API routes and server actions. Never on client directly.
 */

import { db } from '@/lib/database'
import { logger } from '@/lib/logger'
import { cache } from 'react' // React 19 cache() allows re-use of queries/server values per request

export interface UserAddress {
  id?: string // Primary key, assigned by DB
  fullName: string // Receiver's name
  phone?: string
  country?: string
  city?: string
  postalCode?: string
  addressLine1: string // Main street address
  addressLine2?: string // Optional extra
  isDefault?: boolean // True if this address is currently user's default shipping address
  createdAt?: string // ISO timestamp string when address was created
  updatedAt?: string // ISO timestamp string when last updated
}

type AddressRow = UserAddress & Record<string, unknown> // Allows extra DB fields

export const AddressService = {
  /**
   * Get list of all addresses for the given user, sorted newest to oldest.
   * - Uses React's cache for fast and deduped SSR fetches.
   * - On error, returns empty array.
   * 
   * @param userId
   * @returns UserAddress[]
   */
  list: cache(async (userId: string): Promise<UserAddress[]> => {
    try {
      // Query user_addresses table for addresses of given user (desc order, newest first)
      const result = await db().queryDocs<AddressRow>({
        collection: 'user_addresses',
        filters: [{ field: 'userId', operator: '=', value: userId }],
        orderBy: [{ field: 'createdAt', direction: 'desc' }]
      })
      // TODO: Consider invalidating/react-cache when writes occur to avoid stale list.

      if (!result.success) {
        // DB query failed, return empty list
        return []
      }

      // Successful query; return addresses as UserAddress[]
      return result.data as UserAddress[]
    } catch (error) {
      // Log and recover with empty list
      logger.error('AddressService: Error listing addresses', { userId, error })
      return []
    }
  }),

  /**
   * Create a new address record for a user.
   * Also sets default address if specified.
   * Throws on failure.
   * 
   * @param userId
   * @param address - Address values (excluding id, createdAt, updatedAt since these are auto-set)
   * @returns addressId (string)
   */
  async create(userId: string, address: Omit<UserAddress, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      // Generate timestamps
      const now = new Date().toISOString()
      // Prepare DB object for insertion, including extra fields
      const addressData = {
        userId,
        ...address,
        createdAt: now,
        updatedAt: now
      }

      // Insert new address into DB
      const result = await db().createDoc('user_addresses', addressData)
      // MOCK CODE, TODO: Consider handling unique ID assignment at DB-level and returning robust uuid.

      if (!result.success || !result.data) {
        throw new Error('Failed to create address')
      }

      // Use returned id or fallback to a timestamp-based id
      const addressId = result.data.id || `address_${Date.now()}`

      // If new address should be user's default, update all others accordingly
      if (address.isDefault) {
        await this.setDefault(userId, addressId)
        // TODO: Optionally, ensure transactional safety between creation & setting default
      }

      // TODO: Trigger SWR or React 19 cache invalidation for address list (if needed)

      return addressId
    } catch (error) {
      logger.error('AddressService: Error creating address', { userId, error })
      throw error
    }
  },

  /**
   * Update an existing address.
   * Also manages default address switching if isDefault is supplied true.
   * 
   * @param userId
   * @param addressId
   * @param update - Partial fields to update
   */
  async update(userId: string, addressId: string, update: Partial<UserAddress>): Promise<void> {
    try {
      // Always update updatedAt timestamp
      const now = new Date().toISOString()
      // Patch DB record with updated fields
      await db().updateDoc('user_addresses', addressId, {
        ...update,
        updatedAt: now
      })

      // If address is marked default, unset default flag for all others
      if (update.isDefault) {
        await this.setDefault(userId, addressId)
        // TODO: Ensure atomicity between flag update and `setDefault` for correctness
      }
      // TODO: Invalidate/refresh user address cache (React 19, SWR, etc.) to prevent stale reads
    } catch (error) {
      logger.error('AddressService: Error updating address', { userId, addressId, error })
      throw error
    }
  },

  /**
   * Removes an address for given user.
   * (Does NOT currently manage default address fallback if removed address was default)
   * 
   * @param userId
   * @param addressId
   */
  async remove(userId: string, addressId: string): Promise<void> {
    try {
      // Remove address from the DB by id
      await db().deleteDoc('user_addresses', addressId)
      // TODO: If deleted address was default, pick another one as default (if any exist)
      // TODO: Invalidate/refresh user address cache for data consistency
    } catch (error) {
      logger.error('AddressService: Error removing address', { userId, addressId, error })
      throw error
    }
  },

  /**
   * Makes the given address the user's default address.
   * Only one address should be default at a time.
   * 
   * Implementation: Updates all addresses for user, setting isDefault only on target address.
   * 
   * @param userId
   * @param addressId
   */
  async setDefault(userId: string, addressId: string): Promise<void> {
    try {
      // Get all addresses for user (uses cached list)
      const addresses = await this.list(userId)

      // For each address, set isDefault = true only on the correct one, false on others
      // MOCK CODE, TODO: Replace with single bulk DB update query for efficiency instead of N calls in map.
      const updatePromises = addresses.map(addr => 
        this.update(userId, addr.id!, { isDefault: addr.id === addressId })
      )

      await Promise.all(updatePromises)

      // TODO: Invalidate/refresh React 19 cache for user address list on default change
    } catch (error) {
      logger.error('AddressService: Error setting default address', { userId, addressId, error })
      throw error
    }
  }
}
