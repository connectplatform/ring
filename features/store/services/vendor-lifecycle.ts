/**
 * Vendor Lifecycle Service
 * 
 * Manages the complete vendor lifecycle including onboarding, verification,
 * trust scoring, tier progression, and suspension/reinstatement workflows.
 */

import { 
  getCachedDocument,
  createDocument,
  updateDocument,
  getCachedCollectionAdvanced,
  runTransaction
} from '@/lib/services/firebase-helpers'
import { 
  VendorProfile,
  VendorApplication,
  VendorPerformanceMetrics,
  TierProgressionEntry
} from '@/features/store/types/vendor'
import { 
  VendorOnboardingStatus,
  VendorTrustLevel,
  VENDOR_PERFORMANCE_THRESHOLDS,
  TRUST_SCORE_WEIGHTS,
  StoreEvent
} from '@/constants/store'
import { Entity } from '@/features/entities/types'
import { publishEvent } from '@/lib/events/event-bus'

/**
 * Calculate trust score based on performance metrics
 */
export function calculateTrustScore(metrics: VendorPerformanceMetrics): number {
  const {
    orderFulfillmentRate,
    onTimeShipmentRate,
    customerSatisfactionScore,
    returnProcessingTime
  } = metrics

  // Normalize satisfaction score to 0-100 scale
  const normalizedSatisfaction = (customerSatisfactionScore / 5) * 100

  // Calculate weighted score
  const score = 
    orderFulfillmentRate * TRUST_SCORE_WEIGHTS.orderFulfillmentRate +
    onTimeShipmentRate * TRUST_SCORE_WEIGHTS.onTimeShipmentRate +
    normalizedSatisfaction * TRUST_SCORE_WEIGHTS.customerSatisfactionScore

  // Apply penalties for poor return processing
  const returnPenalty = returnProcessingTime > 48 ? 5 : 0

  return Math.max(0, Math.min(100, score - returnPenalty))
}

/**
 * Determine trust level based on trust score and history
 */
export function determineTrustLevel(
  trustScore: number,
  totalOrders: number,
  suspensionCount: number
): VendorTrustLevel {
  // Suspension history affects maximum achievable level
  if (suspensionCount > 2) {
    return VendorTrustLevel.BASIC
  }

  // Trust level progression based on score and order history
  if (trustScore >= 90 && totalOrders >= 500) {
    return VendorTrustLevel.PREMIUM
  } else if (trustScore >= 80 && totalOrders >= 100) {
    return VendorTrustLevel.TRUSTED
  } else if (trustScore >= 70 && totalOrders >= 20) {
    return VendorTrustLevel.VERIFIED
  } else if (trustScore >= 50 && totalOrders >= 5) {
    return VendorTrustLevel.BASIC
  }
  
  return VendorTrustLevel.NEW
}

/**
 * Create a new vendor profile during onboarding
 */
export async function createVendorProfile(
  entityId: string,
  userId: string,
  application?: VendorApplication
): Promise<VendorProfile> {
  const now = new Date().toISOString()
  
  const profile: VendorProfile = {
    id: `vendor_${entityId}`,
    entityId,
    userId,
    onboardingStatus: application?.status === 'approved' 
      ? VendorOnboardingStatus.APPROVED 
      : VendorOnboardingStatus.STARTED,
    onboardingStartedAt: now,
    trustLevel: VendorTrustLevel.NEW,
    trustScore: 50, // Starting trust score
    performanceMetrics: {
      orderFulfillmentRate: 100,
      onTimeShipmentRate: 100,
      customerSatisfactionScore: 5,
      returnProcessingTime: 24,
      totalOrders: 0,
      totalRevenue: 0
    },
    complianceStatus: {
      taxDocumentsSubmitted: false,
      termsAccepted: false,
      dataProcessingAgreementSigned: false
    },
    suspensionHistory: [],
    tierProgressionHistory: [],
    createdAt: now,
    updatedAt: now
  }

  await createDocument('vendorProfiles', profile.id, profile)
  
  // Publish event
  await publishEvent({
    type: StoreEvent.STORE_CREATED,
    payload: { vendorId: profile.id, entityId }
  })

  return profile
}

/**
 * Update vendor onboarding status
 */
export async function updateOnboardingStatus(
  vendorId: string,
  status: VendorOnboardingStatus,
  notes?: string
): Promise<void> {
  const updates: Partial<VendorProfile> = {
    onboardingStatus: status,
    updatedAt: new Date().toISOString()
  }

  if (status === VendorOnboardingStatus.APPROVED) {
    updates.onboardingCompletedAt = new Date().toISOString()
  }

  if (notes) {
    updates.notes = notes
  }

  await updateDocument('vendorProfiles', vendorId, updates)
}

/**
 * Update vendor performance metrics and recalculate trust score
 */
export async function updateVendorPerformance(
  vendorId: string,
  metrics: Partial<VendorPerformanceMetrics>
): Promise<void> {
  const vendor = await getCachedDocument<VendorProfile>('vendorProfiles', vendorId)
  if (!vendor) {
    throw new Error('Vendor not found')
  }

  // Merge new metrics with existing
  const updatedMetrics = {
    ...vendor.performanceMetrics,
    ...metrics
  }

  // Calculate new trust score
  const newTrustScore = calculateTrustScore(updatedMetrics)
  
  // Determine new trust level
  const newTrustLevel = determineTrustLevel(
    newTrustScore,
    updatedMetrics.totalOrders || 0,
    vendor.suspensionHistory.length
  )

  // Check for tier progression
  const tierChanged = newTrustLevel !== vendor.trustLevel

  // Update vendor profile
  await updateDocument('vendorProfiles', vendorId, {
    performanceMetrics: updatedMetrics,
    trustScore: newTrustScore,
    trustLevel: newTrustLevel,
    updatedAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString()
  })

  // Record tier progression if changed
  if (tierChanged) {
    await recordTierProgression(
      vendorId,
      vendor.trustLevel,
      newTrustLevel,
      'Performance-based progression'
    )
  }
}

/**
 * Record tier progression in history
 */
async function recordTierProgression(
  vendorId: string,
  fromTier: VendorTrustLevel,
  toTier: VendorTrustLevel,
  reason: string
): Promise<void> {
  const vendor = await getCachedDocument<VendorProfile>('vendorProfiles', vendorId)
  if (!vendor) return

  const progression: TierProgressionEntry = {
    fromTier,
    toTier,
    date: new Date().toISOString(),
    reason,
    automaticProgression: true
  }

  const updatedHistory = [...vendor.tierProgressionHistory, progression]

  await updateDocument('vendorProfiles', vendorId, {
    tierProgressionHistory: updatedHistory,
    updatedAt: new Date().toISOString()
  })

  // Publish tier change event
  await publishEvent({
    type: StoreEvent.VENDOR_TIER_CHANGED,
    payload: { vendorId, fromTier, toTier, reason }
  })
}

/**
 * Suspend a vendor
 */
export async function suspendVendor(
  vendorId: string,
  reason: string,
  durationDays: number
): Promise<void> {
  const vendor = await getCachedDocument<VendorProfile>('vendorProfiles', vendorId)
  if (!vendor) {
    throw new Error('Vendor not found')
  }

  const suspension = {
    reason,
    date: new Date().toISOString(),
    duration: durationDays,
    resolved: false
  }

  const updatedHistory = [...vendor.suspensionHistory, suspension]

  await updateDocument('vendorProfiles', vendorId, {
    suspensionHistory: updatedHistory,
    trustLevel: VendorTrustLevel.NEW, // Reset to NEW on suspension
    updatedAt: new Date().toISOString()
  })

  // Update entity store status
  const entity = await getCachedDocument<Entity>('entities', vendor.entityId)
  if (entity) {
    await updateDocument('entities', vendor.entityId, {
      storeStatus: 'suspended',
      lastUpdated: new Date()
    })
  }

  // Publish suspension event
  await publishEvent({
    type: StoreEvent.STORE_SUSPENDED,
    payload: { vendorId, reason, duration: durationDays }
  })
}

/**
 * Reinstate a suspended vendor
 */
export async function reinstateVendor(
  vendorId: string,
  notes?: string
): Promise<void> {
  const vendor = await getCachedDocument<VendorProfile>('vendorProfiles', vendorId)
  if (!vendor) {
    throw new Error('Vendor not found')
  }

  // Find the latest unresolved suspension
  const suspensionIndex = vendor.suspensionHistory.findIndex(s => !s.resolved)
  if (suspensionIndex === -1) {
    throw new Error('No active suspension found')
  }

  // Mark suspension as resolved
  const updatedHistory = [...vendor.suspensionHistory]
  updatedHistory[suspensionIndex] = {
    ...updatedHistory[suspensionIndex],
    resolved: true,
    resolvedDate: new Date().toISOString(),
    notes
  }

  await updateDocument('vendorProfiles', vendorId, {
    suspensionHistory: updatedHistory,
    updatedAt: new Date().toISOString()
  })

  // Update entity store status
  const entity = await getCachedDocument<Entity>('entities', vendor.entityId)
  if (entity) {
    await updateDocument('entities', vendor.entityId, {
      storeStatus: 'open',
      lastUpdated: new Date()
    })
  }

  // Publish reinstatement event
  await publishEvent({
    type: StoreEvent.STORE_VERIFIED,
    payload: { vendorId, notes }
  })
}

/**
 * Get vendors by trust level
 */
export async function getVendorsByTrustLevel(
  trustLevel: VendorTrustLevel
): Promise<VendorProfile[]> {
  const vendors = await getCachedCollectionAdvanced<VendorProfile>(
    'vendorProfiles',
    {
      filters: [
        { field: 'trustLevel', operator: '==', value: trustLevel }
      ],
      orderBy: { field: 'trustScore', direction: 'desc' }
    }
  )

  return vendors.items
}

/**
 * Get vendors requiring review
 */
export async function getVendorsRequiringReview(): Promise<VendorProfile[]> {
  const vendors = await getCachedCollectionAdvanced<VendorProfile>(
    'vendorProfiles',
    {
      filters: [
        { field: 'trustScore', operator: '<', value: VENDOR_PERFORMANCE_THRESHOLDS.customerSatisfactionScore * 20 }
      ],
      orderBy: { field: 'trustScore', direction: 'asc' },
      limit: 50
    }
  )

  return vendors.items
}

/**
 * Process vendor applications
 */
export async function processVendorApplication(
  applicationId: string,
  approved: boolean,
  reviewNotes?: string,
  reviewerId?: string
): Promise<void> {
  const application = await getCachedDocument<VendorApplication>('vendorApplications', applicationId)
  if (!application) {
    throw new Error('Application not found')
  }

  const status = approved ? 'approved' : 'rejected'
  const now = new Date().toISOString()

  await updateDocument('vendorApplications', applicationId, {
    status,
    reviewedAt: now,
    reviewedBy: reviewerId,
    reviewNotes,
    updatedAt: now
  })

  if (approved) {
    // Create vendor profile
    await createVendorProfile(application.entityId, application.userId, application)
    
    // Update entity to activate store
    await updateDocument('entities', application.entityId, {
      storeActivated: true,
      storeStatus: 'test', // Start in test mode
      lastUpdated: new Date()
    })
  }
}

/**
 * Run automated vendor performance review
 */
export async function runAutomatedPerformanceReview(): Promise<void> {
  const vendors = await getCachedCollectionAdvanced<VendorProfile>(
    'vendorProfiles',
    {
      filters: [
        { field: 'onboardingStatus', operator: '==', value: VendorOnboardingStatus.APPROVED }
      ]
    }
  )

  for (const vendor of vendors.items) {
    const { performanceMetrics } = vendor
    
    // Check against thresholds
    const belowThresholds = 
      performanceMetrics.orderFulfillmentRate < VENDOR_PERFORMANCE_THRESHOLDS.orderFulfillmentRate ||
      performanceMetrics.onTimeShipmentRate < VENDOR_PERFORMANCE_THRESHOLDS.onTimeShipmentRate ||
      performanceMetrics.customerSatisfactionScore < VENDOR_PERFORMANCE_THRESHOLDS.customerSatisfactionScore

    if (belowThresholds) {
      // Flag for manual review or automatic action
      await updateDocument('vendorProfiles', vendor.id, {
        notes: `Performance below thresholds - Review required`,
        updatedAt: new Date().toISOString()
      })
    }
  }
}
