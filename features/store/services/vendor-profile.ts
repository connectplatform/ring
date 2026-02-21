/**
 * Vendor Profile Service
 * 
 * Service for retrieving vendor profiles and related data
 * Uses React 19 cache() for optimal performance
 */

import { cache } from 'react'
import { initializeDatabase, getDatabaseService } from '@/lib/database'
import { VendorProfile } from '@/features/store/types/vendor'

/**
 * Get vendor profile by entity ID
 * Cached for request deduplication
 */
export const getVendorProfile = cache(async (entityId: string): Promise<VendorProfile | null> => {
  try {
    await initializeDatabase()
    const db = getDatabaseService()
    
    const vendorId = `vendor_${entityId}`
    const result = await db.findById('vendorProfiles', vendorId)
    
    if (!result.success || !result.data) {
      return null
    }
    
    const profile = result.data.data || result.data
    return profile as VendorProfile
  } catch (error) {
    console.error('Error fetching vendor profile:', error)
    return null
  }
})
