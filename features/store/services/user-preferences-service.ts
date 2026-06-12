// 🚀 OPTIMIZED SERVICE: Store-specific user preferences service (Server-side)
// - Direct Firebase operations via service manager
// - Store-focused: shipping addresses, payment methods, vendor settings
// - Separate from general user settings (theme, language, notifications)
// - React 19 cache() for request deduplication
// - Used in API routes and server actions only

import { db } from '@/lib/database'
import { logger } from '@/lib/logger'
import { cache } from 'react'

export interface StoreUserPreferences {
  id?: string
  userId: string
  preferredShippingMethod?: 'nova-post' | 'express' | 'standard' | 'pickup'
  preferredPaymentMethod?: 'wayforpay' | 'crypto' | 'stripe' | 'credit' | 'token' | 'ring'
  lastUsedAddressId?: string
  defaultBillingAddressId?: string
  savePaymentMethods?: boolean
  autoFillShipping?: boolean
  vendorSettings?: {
    autoAcceptOrders?: boolean
    defaultShippingDays?: number
    preferredPayoutMethod?: 'bank' | 'crypto'
    commissionTier?: 'NEW' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM'
  }
  createdAt?: string
  updatedAt?: string
}

export const StoreUserPreferencesService = {
  get: cache(async (userId: string): Promise<StoreUserPreferences | null> => {
    try {
      const userResult = await db().readDoc<Record<string, unknown>>('users', userId)

      if (!userResult.success) {
        if (userResult.metadata?.operation === 'initialize') {
          logger.error('StoreUserPreferencesService: Database initialization failed:', { error: userResult.error })
        }
        return null
      }

      if (!userResult.data) {
        logger.error('StoreUserPreferencesService: User not found:', { userId })
        return null
      }

      const storePrefs = (userResult.data.store_preferences as { checkout?: StoreUserPreferences })?.checkout

      if (!storePrefs) {
        return null
      }

      return { id: 'checkout', userId, ...storePrefs } as StoreUserPreferences
    } catch (error) {
      logger.error('StoreUserPreferencesService: Error getting preferences', { userId, error })
      return null
    }
  }),

  async upsert(userId: string, preferences: Partial<StoreUserPreferences>): Promise<void> {
    try {
      const now = new Date().toISOString()

      const existing = await this.get(userId)
      const checkoutData = {
        ...existing,
        ...preferences,
        updatedAt: now,
        ...(existing ? {} : { createdAt: now })
      }

      const userResult = await db().readDoc<Record<string, unknown>>('users', userId)
      if (!userResult.success || !userResult.data) {
        throw new Error('User not found')
      }

      const userData = userResult.data

      const updatedUserData = {
        ...userData,
        store_preferences: {
          ...(userData.store_preferences as Record<string, unknown> | undefined),
          checkout: checkoutData
        }
      }

      const updateResult = await db().updateDoc('users', userId, updatedUserData)
      if (!updateResult.success) {
        throw new Error('Failed to update user preferences')
      }

    } catch (error) {
      logger.error('StoreUserPreferencesService: Error upserting preferences', { userId, error })
      throw error
    }
  },

  async updateShippingPreference(userId: string, method: StoreUserPreferences['preferredShippingMethod']): Promise<void> {
    await this.upsert(userId, { preferredShippingMethod: method })
  },

  async updatePaymentPreference(userId: string, method: StoreUserPreferences['preferredPaymentMethod']): Promise<void> {
    await this.upsert(userId, { preferredPaymentMethod: method })
  },

  async updateLastUsedAddress(userId: string, addressId: string): Promise<void> {
    await this.upsert(userId, { lastUsedAddressId: addressId })
  },

  async getLastUsedAddress(userId: string): Promise<string | null> {
    const prefs = await this.get(userId)
    return prefs?.lastUsedAddressId || null
  },

  async updateVendorSettings(userId: string, vendorSettings: Partial<StoreUserPreferences['vendorSettings']>): Promise<void> {
    const existing = await this.get(userId)
    const updatedVendorSettings = {
      ...existing?.vendorSettings,
      ...vendorSettings
    }
    await this.upsert(userId, { vendorSettings: updatedVendorSettings })
  },

  async getVendorSettings(userId: string): Promise<StoreUserPreferences['vendorSettings'] | null> {
    const prefs = await this.get(userId)
    return prefs?.vendorSettings || null
  }
}
