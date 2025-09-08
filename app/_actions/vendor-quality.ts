'use server'

/**
 * Vendor Quality Server Actions
 *
 * ERP Extension: Server actions for vendor quality operations that require Firebase Admin SDK
 * Provides safe access to vendor quality data and compliance tracking
 */

import { getCachedDocumentTyped, updateDocumentTyped } from '@/lib/services/firebase-service-manager'
import type {
  ExtendedVendorProfile,
  VendorQualityProfile,
  Certification,
  VendorCompliance,
  ComplianceViolation
} from '@/features/store/types/vendor'

/**
 * Update vendor quality profile with latest metrics
 */
export async function updateQualityProfile(vendorId: string, updates: Partial<VendorQualityProfile>): Promise<void> {
  try {
    const vendor = await getCachedDocumentTyped<ExtendedVendorProfile>('vendorProfiles', vendorId)
    if (!vendor) {
      throw new Error('Vendor not found')
    }

    const updatedQualityProfile = {
      ...vendor.qualityProfile,
      ...updates,
      lastInspectionDate: new Date().toISOString()
    }

    // Recalculate quality score (import the calculation logic)
    const qualityScore = calculateQualityScore({
      ...vendor,
      qualityProfile: updatedQualityProfile
    })

    await updateDocumentTyped('vendorProfiles', vendorId, {
      qualityProfile: {
        ...updatedQualityProfile,
        qualityScore
      },
      updatedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error updating vendor quality profile:', error)
    throw error
  }
}

/**
 * Add certification to vendor profile
 */
export async function addCertification(
  vendorId: string,
  certification: Omit<Certification, 'id'>
): Promise<void> {
  try {
    const vendor = await getCachedDocumentTyped<ExtendedVendorProfile>('vendorProfiles', vendorId)
    if (!vendor) {
      throw new Error('Vendor not found')
    }

    const newCertification: Certification = {
      ...certification,
      id: `cert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    const updatedCertifications = [...vendor.qualityProfile.certifications, newCertification]

    await updateQualityProfile(vendorId, {
      certifications: updatedCertifications
    })
  } catch (error) {
    console.error('Error adding certification:', error)
    throw error
  }
}

/**
 * Update compliance status
 */
export async function updateComplianceStatus(
  vendorId: string,
  complianceUpdates: Partial<VendorCompliance>
): Promise<void> {
  try {
    const vendor = await getCachedDocumentTyped<ExtendedVendorProfile>('vendorProfiles', vendorId)
    if (!vendor) {
      throw new Error('Vendor not found')
    }

    const updatedCompliance = {
      ...vendor.compliance,
      ...complianceUpdates
    }

    // Recalculate compliance rating
    const complianceRating = calculateComplianceScore(updatedCompliance)

    await updateDocumentTyped('vendorProfiles', vendorId, {
      compliance: {
        ...updatedCompliance,
        complianceRating
      },
      updatedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error updating compliance status:', error)
    throw error
  }
}

/**
 * Record compliance violation
 */
export async function recordComplianceViolation(
  vendorId: string,
  violation: Omit<ComplianceViolation, 'id' | 'dateReported'>
): Promise<void> {
  try {
    const vendor = await getCachedDocumentTyped<ExtendedVendorProfile>('vendorProfiles', vendorId)
    if (!vendor) {
      throw new Error('Vendor not found')
    }

    const newViolation: ComplianceViolation = {
      ...violation,
      id: `violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      dateReported: new Date().toISOString()
    }

    const updatedViolations = [...vendor.compliance.complianceViolations, newViolation]

    await updateComplianceStatus(vendorId, {
      complianceViolations: updatedViolations
    })
  } catch (error) {
    console.error('Error recording compliance violation:', error)
    throw error
  }
}

/**
 * Calculate vendor quality score based on multiple factors
 */
function calculateQualityScore(vendorProfile: ExtendedVendorProfile): number {
  const weights = {
    certificationScore: 0.3,
    complianceScore: 0.25,
    performanceScore: 0.25,
    customerSatisfaction: 0.2
  }

  // Certification score (0-100)
  const certScore = calculateCertificationScore(vendorProfile.qualityProfile.certifications)

  // Compliance score (0-100)
  const complianceScore = calculateComplianceScore(vendorProfile.compliance)

  // Performance score (0-100)
  const performanceScore = vendorProfile.analytics.customerSatisfactionScore * 20 // Convert 1-5 to 0-100

  // Customer satisfaction score (0-100)
  const customerScore = vendorProfile.analytics.customerSatisfactionScore * 20

  const totalScore =
    certScore * weights.certificationScore +
    complianceScore * weights.complianceScore +
    performanceScore * weights.performanceScore +
    customerScore * weights.customerSatisfaction

  return Math.round(Math.max(0, Math.min(100, totalScore)))
}

/**
 * Calculate certification score based on active certifications
 */
function calculateCertificationScore(certifications: Certification[]): number {
  if (!certifications.length) return 0

  const activeCerts = certifications.filter(cert => cert.status === 'active')
  const premiumCerts = activeCerts.filter(cert =>
    cert.issuer.toLowerCase().includes('organic') ||
    cert.issuer.toLowerCase().includes('fair trade') ||
    cert.issuer.toLowerCase().includes('gmo free')
  )

  const baseScore = (activeCerts.length / certifications.length) * 60
  const premiumBonus = premiumCerts.length * 10

  return Math.min(100, baseScore + premiumBonus)
}

/**
 * Calculate compliance score based on regulatory compliance
 */
function calculateComplianceScore(compliance: VendorCompliance): number {
  let score = 0

  if (compliance.fsmaCompliant) score += 25
  if (compliance.euGdprCompliant) score += 25
  if (compliance.organicCertified) score += 25
  if (compliance.fairTradeCertified) score += 25

  // Penalty for violations
  const recentViolations = compliance.complianceViolations.filter(
    violation => new Date(violation.dateReported) > new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
  )

  score -= recentViolations.length * 10

  return Math.max(0, score)
}
