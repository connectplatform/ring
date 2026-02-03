/**
 * Store Shipping Address Management (Server-side)
 * 
 * - React 19 cache() for read operations
 * - PostgreSQL DatabaseService for all operations
 * - Used in API routes and server actions only
 */

import { initializeDatabase, getDatabaseService } from '@/lib/database'
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

export const AddressService = {
  list: cache(async (userId: string): Promise<UserAddress[]> => {
    try {
      await initializeDatabase()
      const db = getDatabaseService()
      
      const result = await db.query({
        collection: 'user_addresses',
        filters: [{ field: 'userId', operator: '=', value: userId }],
        orderBy: [{ field: 'createdAt', direction: 'desc' }]
      })
      
      if (!result.success || !result.data) {
        return []
      }
      
      const addresses = Array.isArray(result.data) ? result.data : (result.data as any).data || []
      return addresses.map(item => ({
        id: item.id,
        ...(item.data || item)
      } as UserAddress))
    } catch (error) {
      logger.error('AddressService: Error listing addresses', { userId, error })
      return []
    }
  }),

  async create(userId: string, address: Omit<UserAddress, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      await initializeDatabase()
      const db = getDatabaseService()
      
      const now = new Date().toISOString()
      const addressData = {
        userId,
        ...address,
        createdAt: now,
        updatedAt: now
      }
      
      const result = await db.create('user_addresses', addressData)
      
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
      await initializeDatabase()
      const db = getDatabaseService()
      
      const now = new Date().toISOString()
      await db.update('user_addresses', addressId, {
        ...update,
        updatedAt: now
      })
      
      if (update.isDefault) {
        await this.setDefault(userId, addressId)
      }
    } catch (error) {
      logger.error('AddressService: Error updating address', { userId, addressId, error })
      throw error
    }
  },

  async remove(userId: string, addressId: string): Promise<void> {
    try {
      await initializeDatabase()
      const db = getDatabaseService()
      
      await db.delete('user_addresses', addressId)
    } catch (error) {
      logger.error('AddressService: Error removing address', { userId, addressId, error })
      throw error
    }
  },

  async setDefault(userId: string, addressId: string): Promise<void> {
    try {
      // Get all addresses for this user
      const addresses = await this.list(userId)
      
      // Update all addresses to set isDefault appropriately
      const updatePromises = addresses.map(addr => 
        this.update(userId, addr.id!, { isDefault: addr.id === addressId })
      )
      
      await Promise.all(updatePromises)
    } catch (error) {
      logger.error('AddressService: Error setting default address', { userId, addressId, error })
      throw error
    }
  }
}


