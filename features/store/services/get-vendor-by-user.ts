import { getDatabaseService, initializeDatabase } from '@/lib/database'
import { VendorProfile } from '@/features/store/types/vendor'
import { VendorOnboardingStatus, VendorTrustLevel } from '@/constants/store'
import { logger } from '@/lib/logger'
import { cache } from 'react'

export interface VendorLookupResult {
  found: boolean
  vendorProfile?: VendorProfile
  vendorId?: string
  vendorName?: string
  isApproved: boolean
  isPending: boolean
}

/**
 * Get vendor profile by user ID with caching
 * Auto-creates pending profile if user doesn't have one
 */
export const getVendorByUserId = cache(async (userId: string, userEmail?: string): Promise<VendorLookupResult> => {
  try {
    await initializeDatabase()
    const dbService = getDatabaseService()

    // Query vendor_profiles by user_id
    const vendorResult = await dbService.query({
      collection: 'vendor_profiles',
      filters: [
        { field: 'user_id', operator: '==', value: userId }
      ]
    })

    // If vendor profile exists, return it
    if (vendorResult.success && vendorResult.data && vendorResult.data.length > 0) {
      const vendorDoc = vendorResult.data[0]
      const vendorProfile = vendorDoc.data || vendorDoc
      
      return {
        found: true,
        vendorProfile,
        vendorId: vendorProfile.id,
        vendorName: vendorProfile.store_name || vendorProfile.storeName || vendorProfile.business_name || vendorProfile.businessName || 'Vendor Store',
        isApproved: vendorProfile.onboarding_status === 'approved' || vendorProfile.onboardingStatus === 'approved',
        isPending: vendorProfile.onboarding_status === 'started' || vendorProfile.onboardingStatus === 'started'
      }
    }

    // Auto-create pending vendor profile
    logger.info('Auto-creating pending vendor profile', { userId })
    
    const newVendorId = `vendor_user_${userId}`
    const now = new Date().toISOString()
    
    const newVendorProfile = {
      id: newVendorId,
      user_id: userId,
      entity_id: null, // Will be set when they complete onboarding
      onboarding_status: 'started',
      onboarding_started_at: now,
      trust_level: 'new',
      trust_score: 50.00,
      performance_metrics: {
        totalOrders: 0,
        totalRevenue: 0,
        onTimeShipmentRate: 100,
        orderFulfillmentRate: 100,
        returnProcessingTime: 24,
        customerSatisfactionScore: 5
      },
      compliance_status: {
        termsAccepted: false,
        taxDocumentsSubmitted: false,
        dataProcessingAgreementSigned: false
      },
      suspension_history: [],
      tier_progression_history: [],
      store_name: userEmail ? `${userEmail.split('@')[0]}'s Store` : 'My Store',
      notes: 'Auto-created during product submission'
    }

    const createResult = await dbService.create('vendor_profiles', newVendorProfile)
    
    if (!createResult.success) {
      logger.error('Failed to auto-create vendor profile', { userId, error: createResult.error })
      return {
        found: false,
        isApproved: false,
        isPending: false
      }
    }

    logger.info('Vendor profile auto-created successfully', { vendorId: newVendorId })

    return {
      found: true,
      vendorProfile: newVendorProfile as any,
      vendorId: newVendorId,
      vendorName: newVendorProfile.store_name,
      isApproved: false,
      isPending: true
    }

  } catch (error) {
    logger.error('Error in getVendorByUserId', { userId, error })
    return {
      found: false,
      isApproved: false,
      isPending: false
    }
  }
})

