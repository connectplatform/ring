/**
 * Store Shipping Address Management (Server-side)
 *
 * - Uses React 19 cache() for address list read operations for fast SSR and caching.
 * - All DB operations performed via shared PostgreSQL DatabaseService.
 * - ONLY used in API routes and server actions. Never on client directly.
 */

import { db } from '@/lib/database'
import { logger } from '@/lib/logger'
import { cache } from 'react'

export interface UserAddress {
  id?: string
  fullName: string
  phone?: string
  country?: string
  city?: string
  postalCode?: string
  addressLine1: string
  addressLine2?: string
  isDefault?: boolean
  createdAt?: string
  updatedAt?: string
}

type AddressRow = UserAddress & Record<string, unknown>

export const AddressService = {
  list: cache(async (userId: string): Promise<UserAddress[]> => {
    try {
      const result = await db().queryDocs<AddressRow>({
        collection: 'user_addresses',
        filters: [{ field: 'userId', operator: '=', value: userId }],
        orderBy: [{ field: 'createdAt', direction: 'desc' }],
      })

      if (!result.success) {
        return []
      }

      return result.data as UserAddress[]
    } catch (error) {
      logger.error('AddressService: Error listing addresses', { userId, error })
      return []
    }
  }),

  async create(
    userId: string,
    address: Omit<UserAddress, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<string> {
    try {
      const now = new Date().toISOString()
      const addressData = {
        userId,
        ...address,
        createdAt: now,
        updatedAt: now,
      }

      const result = await db().createDoc('user_addresses', addressData)

      if (!result.success || !result.data) {
        throw new Error('Failed to create address')
      }

      const addressId = result.data.id || `address_${Date.now()}`

      if (address.isDefault) {
        await this.setDefault(userId, addressId)
      }

      return addressId
    } catch (error) {
      logger.error('AddressService: Error creating address', { userId, error })
      throw error
    }
  },

  async update(userId: string, addressId: string, update: Partial<UserAddress>): Promise<void> {
    try {
      const now = new Date().toISOString()
      const { isDefault, ...rest } = update
      await db().updateDoc('user_addresses', addressId, {
        ...rest,
        ...(typeof isDefault === 'boolean' ? { isDefault } : {}),
        updatedAt: now,
      })

      // Avoid recursion: setDefault patches isDefault via updateDoc directly
      if (isDefault === true) {
        await this.setDefault(userId, addressId)
      }
    } catch (error) {
      logger.error('AddressService: Error updating address', { userId, addressId, error })
      throw error
    }
  },

  async remove(userId: string, addressId: string): Promise<void> {
    try {
      await db().deleteDoc('user_addresses', addressId)
    } catch (error) {
      logger.error('AddressService: Error removing address', { userId, addressId, error })
      throw error
    }
  },

  /**
   * Makes the given address the user's default.
   * Patches JSONB rows directly (no update() recursion).
   */
  async setDefault(userId: string, addressId: string): Promise<void> {
    try {
      const addresses = await this.list(userId)
      const now = new Date().toISOString()

      await Promise.all(
        addresses.map(async (addr) => {
          if (!addr.id) return
          const shouldDefault = addr.id === addressId
          if (Boolean(addr.isDefault) === shouldDefault) return
          await db().updateDoc('user_addresses', addr.id, {
            isDefault: shouldDefault,
            updatedAt: now,
          })
        }),
      )
    } catch (error) {
      logger.error('AddressService: Error setting default address', { userId, addressId, error })
      throw error
    }
  },
}
