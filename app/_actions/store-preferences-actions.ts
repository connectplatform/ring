// 🚀 OPTIMIZED SERVER ACTIONS: Store user preferences management
// - React 19 useActionState() compatible server actions
// - Auth.js v5 session management
// - Direct Firebase operations for subcollections
// - Used by client components for preferences management

'use server'

import { auth } from '@/auth'
import { StoreUserPreferencesService, type StoreUserPreferences } from '@/features/store/services/user-preferences-service'
import { logger } from '@/lib/logger'

/**
 * Gets user store preferences (shipping, payment, etc.)
 */
export async function getUserStorePreferences(): Promise<StoreUserPreferences | null> {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      logger.warn('Store Preferences Action: Unauthorized access attempt')
      return null
    }

    const preferences = await StoreUserPreferencesService.get(session.user.id)
    
    logger.info('Store Preferences Action: Retrieved user preferences', {
      userId: session.user.id,
      hasPreferences: !!preferences
    })

    return preferences
  } catch (error) {
    logger.error('Store Preferences Action: Error getting preferences', error)
    return null
  }
}

/**
 * Updates user's preferred shipping method
 */
export async function updateShippingPreference(
  method: StoreUserPreferences['preferredShippingMethod']
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    await StoreUserPreferencesService.updateShippingPreference(session.user.id, method)
    
    logger.info('Store Preferences Action: Updated shipping preference', {
      userId: session.user.id,
      method
    })

    return { success: true }
  } catch (error) {
    logger.error('Store Preferences Action: Error updating shipping preference', error)
    return {
      success: false,
      error: 'Failed to update shipping preference'
    }
  }
}

/**
 * Updates user's preferred payment method
 */
export async function updatePaymentPreference(
  method: StoreUserPreferences['preferredPaymentMethod']
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    await StoreUserPreferencesService.updatePaymentPreference(session.user.id, method)
    
    logger.info('Store Preferences Action: Updated payment preference', {
      userId: session.user.id,
      method
    })

    return { success: true }
  } catch (error) {
    logger.error('Store Preferences Action: Error updating payment preference', error)
    return {
      success: false,
      error: 'Failed to update payment preference'
    }
  }
}

/**
 * Updates user's last used address
 */
export async function updateLastUsedAddress(
  addressId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    await StoreUserPreferencesService.updateLastUsedAddress(session.user.id, addressId)
    
    logger.info('Store Preferences Action: Updated last used address', {
      userId: session.user.id,
      addressId
    })

    return { success: true }
  } catch (error) {
    logger.error('Store Preferences Action: Error updating last used address', error)
    return {
      success: false,
      error: 'Failed to update last used address'
    }
  }
}

/**
 * Updates multiple user preferences at once
 */
export async function updateUserStorePreferences(
  preferences: Partial<StoreUserPreferences>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    // Remove userId from preferences to avoid conflicts
    const { userId, ...prefsToUpdate } = preferences

    await StoreUserPreferencesService.upsert(session.user.id, prefsToUpdate)
    
    logger.info('Store Preferences Action: Updated user preferences', {
      userId: session.user.id,
      updatedFields: Object.keys(prefsToUpdate)
    })

    return { success: true }
  } catch (error) {
    logger.error('Store Preferences Action: Error updating preferences', error)
    return {
      success: false,
      error: 'Failed to update preferences'
    }
  }
}
