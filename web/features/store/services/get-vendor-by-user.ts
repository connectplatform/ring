import { db } from '@/lib/database'
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
    const vendorResult = await db().queryDocs<VendorProfile>({
      collection: 'vendor_profiles',
      filters: [
        { field: 'userId', operator: '==', value: userId }
      ]
    })

    if (vendorResult.success && vendorResult.data.length > 0) {
      const vendorProfile = vendorResult.data[0]

      return {
        found: true,
        vendorProfile,
        vendorId: vendorProfile.id,
        vendorName: vendorProfile.storeName ?? vendorProfile.businessName ?? 'Vendor Store',
        isApproved: vendorProfile.onboardingStatus === VendorOnboardingStatus.APPROVED,
        isPending: vendorProfile.onboardingStatus === VendorOnboardingStatus.STARTED
      }
    }

    logger.info('Auto-creating pending vendor profile', { userId })
    
    const newVendorId = `vendor_user_${userId}`
    const now = new Date().toISOString()
    
    const newVendorProfile: VendorProfile = {
      id: newVendorId,
      userId,
      entityId: '',
      onboardingStatus: VendorOnboardingStatus.STARTED,
      onboardingStartedAt: now,
      trustLevel: VendorTrustLevel.NEW,
      trustScore: 50,
      performanceMetrics: {
        totalOrders: 0,
        totalRevenue: 0,
        onTimeShipmentRate: 100,
        orderFulfillmentRate: 100,
        returnProcessingTime: 24,
        customerSatisfactionScore: 5
      },
      complianceStatus: {
        termsAccepted: false,
        taxDocumentsSubmitted: false,
        dataProcessingAgreementSigned: false
      },
      suspensionHistory: [],
      tierProgressionHistory: [],
      storeName: userEmail ? `${userEmail.split('@')[0]}'s Store` : 'My Store',
      notes: 'Auto-created during product submission',
      createdAt: now,
      updatedAt: now,
    }

    const createResult = await db().createDoc('vendor_profiles', newVendorProfile, { id: newVendorId })
    
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
      vendorProfile: newVendorProfile,
      vendorId: newVendorId,
      vendorName: newVendorProfile.storeName,
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
