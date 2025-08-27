/**
 * Vendor Profile Service
 * 
 * Service for retrieving vendor profiles and related data
 */

import { getCachedDocument } from '@/lib/services/firebase-helpers'
import { VendorProfile } from '@/features/store/types/vendor'

/**
 * Get vendor profile by entity ID
 */
export async function getVendorProfile(entityId: string): Promise<VendorProfile | null> {
  try {
    const vendorId = `vendor_${entityId}`
    const profile = await getCachedDocument<VendorProfile>('vendorProfiles', vendorId)
    return profile
  } catch (error) {
    console.error('Error fetching vendor profile:', error)
    return null
  }
}
