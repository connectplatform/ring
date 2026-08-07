/**
 * Vendor Profile Service
 * 
 * Service for retrieving vendor profiles and related data
 * Uses React 19 cache() for optimal performance
 */

import { cache } from 'react'
import { db } from '@/lib/database'
import { VendorProfile } from '@/features/store/types/vendor'
import { STORE_COLLECTIONS } from '@/features/store/constants/collections'

/**
 * Get vendor profile by entity ID
 * Cached for request deduplication
 */
export const getVendorProfile = cache(async (entityId: string): Promise<VendorProfile | null> => {
  try {
    const vendorId = `vendor_${entityId}`
    const result = await db().findDocById<VendorProfile & Record<string, unknown>>(
      STORE_COLLECTIONS.vendorProfiles,
      vendorId
    )
    
    if (!result.success || !result.data) {
      return null
    }
    
    return result.data as VendorProfile
  } catch (error) {
    console.error('Error fetching vendor profile:', error)
    return null
  }
})
