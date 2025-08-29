// 🚀 OPTIMIZED SERVICE: Store shipping address management (Server-side)
// - Direct Firebase operations via service manager
// - React 19 cache() for request deduplication
// - Firestore subcollection for user addresses
// - Used in API routes and server actions only

import { getFirebaseServiceManager } from '@/lib/services/firebase-service-manager'
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
      const { db } = getFirebaseServiceManager()
      const snapshot = await db
        .collection('users')
        .doc(userId)
        .collection('addresses')
        .orderBy('createdAt', 'desc')
        .get()
      
      return snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as UserAddress))
    } catch (error) {
      logger.error('AddressService: Error listing addresses', { userId, error })
      return []
    }
  }),

  async create(userId: string, address: Omit<UserAddress, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const { db } = getFirebaseServiceManager()
      const now = new Date().toISOString()
      const docRef = await db
        .collection('users')
        .doc(userId)
        .collection('addresses')
        .add({
          ...address,
          createdAt: now,
          updatedAt: now
        })

      if (address.isDefault) {
        await this.setDefault(userId, docRef.id)
      }
      
      return docRef.id
    } catch (error) {
      logger.error('AddressService: Error creating address', { userId, error })
      throw error
    }
  },

  async update(userId: string, addressId: string, update: Partial<UserAddress>): Promise<void> {
    try {
      const { db } = getFirebaseServiceManager()
      const now = new Date().toISOString()
      await db
        .collection('users')
        .doc(userId)
        .collection('addresses')
        .doc(addressId)
        .update({ 
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
      const { db } = getFirebaseServiceManager()
      await db
        .collection('users')
        .doc(userId)
        .collection('addresses')
        .doc(addressId)
        .delete()
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


