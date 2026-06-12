/**
 * Vendor Lifecycle Service
 * 
 * Manages the complete vendor lifecycle including onboarding, verification,
 * trust scoring, tier progression, and suspension/reinstatement workflows.
 */

import { db } from '@/lib/database'
import { 
  VendorProfile,
  VendorApplication,
  VendorPerformanceMetrics,
  TierProgressionEntry,
  SuspensionHistoryEntry
} from '@/features/store/types/vendor'
import { 
  VendorOnboardingStatus,
  VendorTrustLevel,
  VENDOR_PERFORMANCE_THRESHOLDS,
  TRUST_SCORE_WEIGHTS,
  StoreEvent
} from '@/constants/store'
import { publishEvent } from '@/lib/events/event-bus.server'

/** Entity table rows use snake_case top-level columns; nested vendor_profile is camelCase. */
type EntityRow = Record<string, unknown> & {
  vendor_profile?: VendorProfile
  store_status?: string
  store_activated?: boolean
  trust_score?: number
  verification_status?: string
}

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

  const entityResult = await db().readDoc<EntityRow>('entities', entityId);
  if (!entityResult.success || !entityResult.data) {
    throw new Error('Entity not found');
  }

  const entityData = entityResult.data;

  const updatedEntityData = {
    ...entityData,
    vendor_profile: profile,
    store_activated: true,
    store_status: 'test', // Start in test mode
    trust_score: profile.trustScore / 100, // Convert to decimal format for DB
    verification_status: profile.onboardingStatus === VendorOnboardingStatus.APPROVED ? 'verified' : 'pending',
    updated_at: new Date()
  };

  const updateResult = await db().updateDoc('entities', entityId, updatedEntityData);
  if (!updateResult.success) {
    throw new Error('Failed to create vendor profile');
  }

  const profileRow = await db().createDoc('vendor_profiles', profile, { id: profile.id });
  if (!profileRow.success) {
    console.warn('createVendorProfile: vendor_profiles write-through failed', profileRow.error);
  }

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

  const entityResult = await db().readDoc<EntityRow>('entities', vendorId);
  if (!entityResult.success || !entityResult.data) {
    throw new Error('Vendor entity not found');
  }

  const entityData = entityResult.data;
  const currentVendorProfile = entityData.vendor_profile ?? ({} as VendorProfile);

  const updatedVendorProfile: VendorProfile = {
    ...currentVendorProfile,
    ...updates,
  };

  const updatedEntityData = {
    ...entityData,
    vendor_profile: updatedVendorProfile,
    verification_status: status === VendorOnboardingStatus.APPROVED ? 'verified' : 'pending',
    updated_at: new Date()
  };

  const updateResult = await db().updateDoc('entities', vendorId, updatedEntityData);
  if (!updateResult.success) {
    throw new Error('Failed to update vendor onboarding status');
  }

  const profileRowId = vendorId.startsWith('vendor_') ? vendorId : `vendor_${vendorId}`;
  const mirror = await db().readDoc<VendorProfile>('vendor_profiles', profileRowId);
  if (mirror.success && mirror.data) {
    await db().updateDoc('vendor_profiles', profileRowId, {
      ...mirror.data,
      ...updates,
    });
  }
}

/**
 * Update vendor performance metrics and recalculate trust score
 */
export async function updateVendorPerformance(
  vendorId: string,
  metrics: Partial<VendorPerformanceMetrics>
): Promise<void> {
  const vendorResult = await db().readDoc<VendorProfile>('vendor_profiles', vendorId);
  if (!vendorResult.success || !vendorResult.data) {
    throw new Error('Vendor not found');
  }

  const vendor = vendorResult.data;

  const updatedMetrics: VendorPerformanceMetrics = {
    ...vendor.performanceMetrics,
    ...metrics,
  };

  const newTrustScore = calculateTrustScore(updatedMetrics);

  const newTrustLevel = determineTrustLevel(
    newTrustScore,
    updatedMetrics.totalOrders || 0,
    vendor.suspensionHistory.length
  );

  const tierChanged = newTrustLevel !== vendor.trustLevel;

  const updatedVendorData: VendorProfile = {
    ...vendor,
    performanceMetrics: updatedMetrics,
    trustScore: newTrustScore,
    trustLevel: newTrustLevel,
    updatedAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };

  const updateResult = await db().updateDoc('vendor_profiles', vendorId, updatedVendorData);
  if (!updateResult.success) {
    throw new Error('Failed to update vendor performance');
  }

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
  const vendorResult = await db().readDoc<VendorProfile>('vendor_profiles', vendorId);
  if (!vendorResult.success || !vendorResult.data) return;

  const vendor = vendorResult.data;

  const progression: TierProgressionEntry = {
    fromTier,
    toTier,
    date: new Date().toISOString(),
    reason,
    automaticProgression: true
  };

  const updatedVendorData: VendorProfile = {
    ...vendor,
    tierProgressionHistory: [...vendor.tierProgressionHistory, progression],
    updatedAt: new Date().toISOString(),
  };

  await db().updateDoc('vendor_profiles', vendorId, updatedVendorData);

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
  const vendorResult = await db().readDoc<VendorProfile>('vendor_profiles', vendorId);
  if (!vendorResult.success || !vendorResult.data) {
    throw new Error('Vendor not found');
  }

  const vendor = vendorResult.data;

  const suspension: SuspensionHistoryEntry = {
    reason,
    date: new Date().toISOString(),
    duration: durationDays,
    resolved: false
  };

  const updatedVendorData: VendorProfile = {
    ...vendor,
    suspensionHistory: [...vendor.suspensionHistory, suspension],
    trustLevel: VendorTrustLevel.NEW,
    updatedAt: new Date().toISOString(),
  };

  const updateResult = await db().updateDoc('vendor_profiles', vendorId, updatedVendorData);
  if (!updateResult.success) {
    throw new Error('Failed to update vendor profile');
  }

  const entityId = vendor.entityId;
  if (entityId) {
    const entityResult = await db().readDoc<EntityRow>('entities', entityId);
    if (entityResult.success && entityResult.data) {
      await db().updateDoc('entities', entityId, {
        ...entityResult.data,
        store_status: 'suspended',
        updated_at: new Date()
      });
    }
  }

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
  const vendorResult = await db().readDoc<VendorProfile>('vendor_profiles', vendorId);
  if (!vendorResult.success || !vendorResult.data) {
    throw new Error('Vendor not found');
  }

  const vendor = vendorResult.data;

  const suspensionIndex = vendor.suspensionHistory.findIndex((s) => !s.resolved);
  if (suspensionIndex === -1) {
    throw new Error('No active suspension found');
  }

  const updatedHistory = [...vendor.suspensionHistory];
  updatedHistory[suspensionIndex] = {
    ...updatedHistory[suspensionIndex],
    resolved: true,
    resolvedDate: new Date().toISOString(),
    notes
  };

  const updatedVendorData: VendorProfile = {
    ...vendor,
    suspensionHistory: updatedHistory,
    updatedAt: new Date().toISOString(),
  };

  const updateResult = await db().updateDoc('vendor_profiles', vendorId, updatedVendorData);
  if (!updateResult.success) {
    throw new Error('Failed to update vendor profile');
  }

  const entityId = vendor.entityId;
  if (entityId) {
    const entityResult = await db().readDoc<EntityRow>('entities', entityId);
    if (entityResult.success && entityResult.data) {
      await db().updateDoc('entities', entityId, {
        ...entityResult.data,
        store_status: 'open',
        updated_at: new Date()
      });
    }
  }

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
  const queryResult = await db().queryDocs<VendorProfile>({
    collection: 'vendor_profiles',
    filters: [
      { field: 'trustLevel', operator: '==' as const, value: trustLevel }
    ],
    orderBy: [{ field: 'trustScore', direction: 'desc' as const }],
    pagination: { limit: 100 }
  });

  if (!queryResult.success) {
    return [];
  }

  return queryResult.data;
}

/**
 * Get vendors requiring review
 */
export async function getVendorsRequiringReview(): Promise<VendorProfile[]> {
  const queryResult = await db().queryDocs<VendorProfile>({
    collection: 'vendor_profiles',
    filters: [
      { field: 'trustScore', operator: '<' as const, value: VENDOR_PERFORMANCE_THRESHOLDS.customerSatisfactionScore * 20 }
    ],
    orderBy: [{ field: 'trustScore', direction: 'asc' as const }],
    pagination: { limit: 50 }
  });

  if (!queryResult.success) {
    return [];
  }

  return queryResult.data;
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
  const applicationResult = await db().readDoc<VendorApplication>(
    'vendor_applications',
    applicationId
  );
  if (!applicationResult.success || !applicationResult.data) {
    throw new Error('Application not found');
  }

  const application = applicationResult.data;

  const status = approved ? 'approved' : 'rejected';
  const now = new Date().toISOString();

  const updatedApplication: VendorApplication = {
    ...application,
    status,
    reviewedAt: now,
    reviewedBy: reviewerId,
    reviewNotes: reviewNotes,
    updatedAt: now,
  };

  const updateResult = await db().updateDoc('vendor_applications', applicationId, updatedApplication);
  if (!updateResult.success) {
    throw new Error('Failed to update application');
  }

  if (approved) {
    await createVendorProfile(application.entityId, application.userId, application);

    const entityId = application.entityId;
    if (entityId) {
      const entityResult = await db().readDoc<EntityRow>('entities', entityId);
      if (entityResult.success && entityResult.data) {
        await db().updateDoc('entities', entityId, {
          ...entityResult.data,
          store_activated: true,
          store_status: 'test',
          updated_at: new Date()
        });
      }
    }
  }
}

/**
 * Run automated vendor performance review
 */
export async function runAutomatedPerformanceReview(): Promise<void> {
  const queryResult = await db().queryDocs<VendorProfile>({
    collection: 'vendor_profiles',
    filters: [
      { field: 'onboardingStatus', operator: '==' as const, value: VendorOnboardingStatus.APPROVED }
    ],
    pagination: { limit: 1000 }
  });

  if (!queryResult.success) {
    return;
  }

  for (const vendor of queryResult.data) {
    const performanceMetrics = vendor.performanceMetrics;

    const belowThresholds =
      performanceMetrics.orderFulfillmentRate < VENDOR_PERFORMANCE_THRESHOLDS.orderFulfillmentRate ||
      performanceMetrics.onTimeShipmentRate < VENDOR_PERFORMANCE_THRESHOLDS.onTimeShipmentRate ||
      performanceMetrics.customerSatisfactionScore < VENDOR_PERFORMANCE_THRESHOLDS.customerSatisfactionScore;

    if (belowThresholds) {
      const updatedVendorData: VendorProfile = {
        ...vendor,
        notes: `Performance below thresholds - Review required`,
        updatedAt: new Date().toISOString(),
      };

      await db().updateDoc('vendor_profiles', vendor.id, updatedVendorData);
    }
  }
}
