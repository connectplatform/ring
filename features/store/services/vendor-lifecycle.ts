/**
 * Vendor Lifecycle Service
 * 
 * Manages the complete vendor lifecycle including onboarding, verification,
 * trust scoring, tier progression, and suspension/reinstatement workflows.
 */

import {
  getDatabaseService,
  initializeDatabase
} from '@/lib/database'
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
import { publishEvent } from '@/lib/events/event-bus.server'

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

  // Since vendor data is stored in entities table, update the entity
  const dbService = getDatabaseService();

  // Read the current entity
  const entityResult = await dbService.read('entities', entityId);
  if (!entityResult.success || !entityResult.data) {
    throw new Error('Entity not found');
  }

  const entityData = entityResult.data.data || entityResult.data;

  // Update entity with vendor profile data
  const updatedEntityData = {
    ...entityData,
    // Store vendor profile data in the JSONB data field or as additional entity fields
    vendor_profile: profile,
    store_activated: true,
    store_status: 'test', // Start in test mode
    trust_score: profile.trustScore / 100, // Convert to decimal format for DB
    verification_status: profile.onboardingStatus === VendorOnboardingStatus.APPROVED ? 'verified' : 'pending',
    updated_at: new Date()
  };

  const updateResult = await dbService.update('entities', entityId, updatedEntityData);
  if (!updateResult.success) {
    throw new Error('Failed to create vendor profile');
  }

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

  // Update entity with vendor profile changes
  const dbService = getDatabaseService();

  // Read current entity
  const entityResult = await dbService.read('entities', vendorId);
  if (!entityResult.success || !entityResult.data) {
    throw new Error('Vendor entity not found');
  }

  const entityData = entityResult.data.data || entityResult.data;
  const currentVendorProfile = entityData.vendor_profile || {};

  // Update vendor profile within entity
  const updatedVendorProfile = {
    ...currentVendorProfile,
    ...updates
  };

  const updatedEntityData = {
    ...entityData,
    vendor_profile: updatedVendorProfile,
    verification_status: status === VendorOnboardingStatus.APPROVED ? 'verified' : 'pending',
    updated_at: new Date()
  };

  const updateResult = await dbService.update('entities', vendorId, updatedEntityData);
  if (!updateResult.success) {
    throw new Error('Failed to update vendor onboarding status');
  }
}

/**
 * Update vendor performance metrics and recalculate trust score
 */
export async function updateVendorPerformance(
  vendorId: string,
  metrics: Partial<VendorPerformanceMetrics>
): Promise<void> {
  const dbService = getDatabaseService();

  // Read current vendor profile
  const vendorResult = await dbService.read('vendor_profiles', vendorId);
  if (!vendorResult.success || !vendorResult.data) {
    throw new Error('Vendor not found');
  }

  const vendor = vendorResult.data.data || vendorResult.data;

  // Merge new metrics with existing
  const updatedMetrics = {
    ...vendor.performance_metrics,
    ...metrics
  };

  // Calculate new trust score
  const newTrustScore = calculateTrustScore(updatedMetrics);

  // Determine new trust level
  const newTrustLevel = determineTrustLevel(
    newTrustScore,
    updatedMetrics.totalOrders || 0,
    (vendor.suspension_history || []).length
  );

  // Check for tier progression
  const tierChanged = newTrustLevel !== vendor.trust_level;

  // Update vendor profile
  const updatedVendorData = {
    ...vendor,
    performance_metrics: updatedMetrics,
    trust_score: newTrustScore,
    trust_level: newTrustLevel,
    updated_at: new Date(),
    last_active_at: new Date()
  };

  const updateResult = await dbService.update('vendor_profiles', vendorId, updatedVendorData);
  if (!updateResult.success) {
    throw new Error('Failed to update vendor performance');
  }

  // Record tier progression if changed
  if (tierChanged) {
    await recordTierProgression(
      vendorId,
      vendor.trust_level,
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
  const dbService = getDatabaseService();

  // Read current vendor profile
  const vendorResult = await dbService.read('vendor_profiles', vendorId);
  if (!vendorResult.success || !vendorResult.data) return;

  const vendor = vendorResult.data.data || vendorResult.data;

  const progression: TierProgressionEntry = {
    fromTier,
    toTier,
    date: new Date().toISOString(),
    reason,
    automaticProgression: true
  };

  const currentHistory = vendor.tier_progression_history || [];
  const updatedHistory = [...currentHistory, progression];

  // Update vendor profile with new history
  const updatedVendorData = {
    ...vendor,
    tier_progression_history: updatedHistory,
    updated_at: new Date()
  };

  await dbService.update('vendor_profiles', vendorId, updatedVendorData);

  // Publish tier change event
  await publishEvent({
    type: StoreEvent.VENDOR_TIER_CHANGED,
    payload: { vendorId, fromTier, toTier, reason }
  });
}

/**
 * Suspend a vendor
 */
export async function suspendVendor(
  vendorId: string,
  reason: string,
  durationDays: number
): Promise<void> {
  const dbService = getDatabaseService();

  // Read current vendor profile
  const vendorResult = await dbService.read('vendor_profiles', vendorId);
  if (!vendorResult.success || !vendorResult.data) {
    throw new Error('Vendor not found');
  }

  const vendor = vendorResult.data.data || vendorResult.data;

  const suspension = {
    reason,
    date: new Date().toISOString(),
    duration: durationDays,
    resolved: false
  };

  const currentHistory = vendor.suspension_history || [];
  const updatedHistory = [...currentHistory, suspension];

  // Update vendor profile
  const updatedVendorData = {
    ...vendor,
    suspension_history: updatedHistory,
    trust_level: VendorTrustLevel.NEW, // Reset to NEW on suspension
    updated_at: new Date()
  };

  const updateResult = await dbService.update('vendor_profiles', vendorId, updatedVendorData);
  if (!updateResult.success) {
    throw new Error('Failed to update vendor profile');
  }

  // Update entity store status
  const entityResult = await dbService.read('entities', vendor.entity_id);
  if (entityResult.success && entityResult.data) {
    const entityData = entityResult.data.data || entityResult.data;
    const updatedEntityData = {
      ...entityData,
      store_status: 'suspended',
      updated_at: new Date()
    };

    await dbService.update('entities', vendor.entity_id, updatedEntityData);
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
  const dbService = getDatabaseService();

  // Read current vendor profile
  const vendorResult = await dbService.read('vendor_profiles', vendorId);
  if (!vendorResult.success || !vendorResult.data) {
    throw new Error('Vendor not found');
  }

  const vendor = vendorResult.data.data || vendorResult.data;

  // Find the latest unresolved suspension
  const suspensionHistory = vendor.suspension_history || [];
  const suspensionIndex = suspensionHistory.findIndex((s: any) => !s.resolved);
  if (suspensionIndex === -1) {
    throw new Error('No active suspension found');
  }

  // Mark suspension as resolved
  const updatedHistory = [...suspensionHistory];
  updatedHistory[suspensionIndex] = {
    ...updatedHistory[suspensionIndex],
    resolved: true,
    resolvedDate: new Date().toISOString(),
    notes
  };

  // Update vendor profile
  const updatedVendorData = {
    ...vendor,
    suspension_history: updatedHistory,
    updated_at: new Date()
  };

  const updateResult = await dbService.update('vendor_profiles', vendorId, updatedVendorData);
  if (!updateResult.success) {
    throw new Error('Failed to update vendor profile');
  }

  // Update entity store status
  const entityResult = await dbService.read('entities', vendor.entity_id);
  if (entityResult.success && entityResult.data) {
    const entityData = entityResult.data.data || entityResult.data;
    const updatedEntityData = {
      ...entityData,
      store_status: 'open',
      updated_at: new Date()
    };

    await dbService.update('entities', vendor.entity_id, updatedEntityData);
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
  const dbService = getDatabaseService();

  const queryResult = await dbService.query({
    collection: 'vendor_profiles',
    filters: [
      { field: 'trust_level', operator: '==' as const, value: trustLevel }
    ],
    orderBy: [{ field: 'trust_score', direction: 'desc' as const }],
    pagination: { limit: 100 }
  });

  if (!queryResult.success) {
    return [];
  }

  return queryResult.data.map(item => item.data as VendorProfile);
}

/**
 * Get vendors requiring review
 */
export async function getVendorsRequiringReview(): Promise<VendorProfile[]> {
  const dbService = getDatabaseService();

  const queryResult = await dbService.query({
    collection: 'vendor_profiles',
    filters: [
      { field: 'trust_score', operator: '<' as const, value: VENDOR_PERFORMANCE_THRESHOLDS.customerSatisfactionScore * 20 }
    ],
    orderBy: [{ field: 'trust_score', direction: 'asc' as const }],
    pagination: { limit: 50 }
  });

  if (!queryResult.success) {
    return [];
  }

  return queryResult.data.map(item => item.data as VendorProfile);
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
  const dbService = getDatabaseService();

  // Read application
  const applicationResult = await dbService.read('vendor_applications', applicationId);
  if (!applicationResult.success || !applicationResult.data) {
    throw new Error('Application not found');
  }

  const application = applicationResult.data.data || applicationResult.data;

  const status = approved ? 'approved' : 'rejected';
  const now = new Date();

  // Update application
  const updatedApplicationData = {
    ...application,
    status,
    reviewed_at: now,
    reviewed_by: reviewerId,
    review_notes: reviewNotes,
    updated_at: now
  };

  const updateResult = await dbService.update('vendor_applications', applicationId, updatedApplicationData);
  if (!updateResult.success) {
    throw new Error('Failed to update application');
  }

  if (approved) {
    // Create vendor profile
    await createVendorProfile(application.entity_id, application.user_id, application);

    // Update entity to activate store
    const entityResult = await dbService.read('entities', application.entity_id);
    if (entityResult.success && entityResult.data) {
      const entityData = entityResult.data.data || entityResult.data;
      const updatedEntityData = {
        ...entityData,
        store_activated: true,
        store_status: 'test', // Start in test mode
        updated_at: new Date()
      };

      await dbService.update('entities', application.entity_id, updatedEntityData);
    }
  }
}

/**
 * Run automated vendor performance review
 */
export async function runAutomatedPerformanceReview(): Promise<void> {
  const dbService = getDatabaseService();

  const queryResult = await dbService.query({
    collection: 'vendor_profiles',
    filters: [
      { field: 'onboarding_status', operator: '==' as const, value: VendorOnboardingStatus.APPROVED }
    ],
    pagination: { limit: 1000 }
  });

  if (!queryResult.success) {
    return;
  }

  for (const item of queryResult.data) {
    const vendor = item.data as VendorProfile;
    const { performanceMetrics } = vendor;

    // Check against thresholds
    const belowThresholds =
      performanceMetrics.orderFulfillmentRate < VENDOR_PERFORMANCE_THRESHOLDS.orderFulfillmentRate ||
      performanceMetrics.onTimeShipmentRate < VENDOR_PERFORMANCE_THRESHOLDS.onTimeShipmentRate ||
      performanceMetrics.customerSatisfactionScore < VENDOR_PERFORMANCE_THRESHOLDS.customerSatisfactionScore;

    if (belowThresholds) {
      // Flag for manual review or automatic action
      const updatedVendorData = {
        ...vendor,
        notes: `Performance below thresholds - Review required`,
        updated_at: new Date()
      };

      await dbService.update('vendor_profiles', vendor.id, updatedVendorData);
    }
  }
}
