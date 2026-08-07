/**
 * Vendor Quality & Compliance Service
 *
 * ERP Extension: Manages vendor quality profiles, certifications, and compliance tracking
 * Integrates with existing vendor management system to provide comprehensive quality assurance
 *
 * NOTE: Server operations moved to server actions to avoid Firebase Admin SDK client-side issues
 */

import {
  updateQualityProfile as updateQualityProfileServerAction,
  addCertification as addCertificationServerAction,
  updateComplianceStatus as updateComplianceStatusServerAction,
  recordComplianceViolation as recordComplianceViolationServerAction
} from '@/app/_actions/vendor-quality'

import type {
  ExtendedVendorProfile,
  VendorQualityProfile,
  Certification,
  VendorCompliance,
  ComplianceViolation
} from '@/features/store/types/vendor'

// ERP Extension: Quality assessment service
export class VendorQualityService {
  /**
   * Calculate vendor quality score based on multiple factors
   */
  static calculateQualityScore(vendorProfile: ExtendedVendorProfile): number {
    const weights = {
      certificationScore: 0.3,
      complianceScore: 0.25,
      performanceScore: 0.25,
      customerSatisfaction: 0.2
    }

    // Certification score (0-100)
    const certScore = this.calculateCertificationScore(vendorProfile.qualityProfile.certifications)

    // Compliance score (0-100)
    const complianceScore = this.calculateComplianceScore(vendorProfile.compliance)

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
  private static calculateCertificationScore(certifications: Certification[]): number {
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
  private static calculateComplianceScore(compliance: VendorCompliance): number {
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

  /**
   * Update vendor quality profile with latest metrics
   */
  static async updateQualityProfile(vendorId: string, updates: Partial<VendorQualityProfile>): Promise<void> {
    return updateQualityProfileServerAction(vendorId, updates)
  }

  /**
   * Add certification to vendor profile
   */
  static async addCertification(
    vendorId: string,
    certification: Omit<Certification, 'id'>
  ): Promise<void> {
    return addCertificationServerAction(vendorId, certification)
  }

  /**
   * Update compliance status
   */
  static async updateComplianceStatus(
    vendorId: string,
    complianceUpdates: Partial<VendorCompliance>
  ): Promise<void> {
    return updateComplianceStatusServerAction(vendorId, complianceUpdates)
  }

  /**
   * Record compliance violation
   */
  static async recordComplianceViolation(
    vendorId: string,
    violation: Omit<ComplianceViolation, 'id' | 'dateReported'>
  ): Promise<void> {
    return recordComplianceViolationServerAction(vendorId, violation)
  }

  /**
   * Get quality assurance recommendations for vendor
   */
  static getQualityRecommendations(vendorProfile: ExtendedVendorProfile): string[] {
    const recommendations: string[] = []

    // Certification recommendations
    if (vendorProfile.qualityProfile.certifications.length === 0) {
      recommendations.push('Consider obtaining organic or fair trade certification to improve market positioning')
    }

    // Compliance recommendations
    if (!vendorProfile.compliance.fsmaCompliant) {
      recommendations.push('Implement FSMA compliance measures for food safety standards')
    }

    if (!vendorProfile.compliance.organicCertified) {
      recommendations.push('Pursue organic certification to appeal to health-conscious consumers')
    }

    // Performance recommendations
    if (vendorProfile.analytics.customerSatisfactionScore < 4.0) {
      recommendations.push('Focus on improving customer satisfaction through better service quality')
    }

    if (vendorProfile.analytics.returnRate > 5) {
      recommendations.push('Investigate and reduce product return rates through quality improvements')
    }

    // Operational recommendations
    if (vendorProfile.operationalMetrics.qualityControlPassRate < 95) {
      recommendations.push('Enhance quality control processes to improve pass rates')
    }

    return recommendations
  }

  /**
   * Generate quality audit report
   */
  static generateQualityAudit(vendorProfile: ExtendedVendorProfile): {
    overallScore: number
    strengths: string[]
    improvementAreas: string[]
    complianceStatus: 'compliant' | 'warning' | 'non_compliant'
    recommendations: string[]
  } {
    const overallScore = vendorProfile.qualityProfile.qualityScore
    const strengths: string[] = []
    const improvementAreas: string[] = []

    // Assess strengths
    if (vendorProfile.compliance.organicCertified) {
      strengths.push('Organic certification demonstrates commitment to quality')
    }

    if (vendorProfile.analytics.customerSatisfactionScore >= 4.5) {
      strengths.push('Excellent customer satisfaction scores')
    }

    if (vendorProfile.qualityProfile.qualityScore >= 90) {
      strengths.push('Premium quality score indicates superior product standards')
    }

    // Identify improvement areas
    if (vendorProfile.compliance.complianceViolations.length > 0) {
      improvementAreas.push('Address outstanding compliance violations')
    }

    if (vendorProfile.analytics.returnRate > 3) {
      improvementAreas.push('Reduce product return rates through quality improvements')
    }

    // Determine compliance status
    let complianceStatus: 'compliant' | 'warning' | 'non_compliant' = 'compliant'

    if (vendorProfile.compliance.complianceViolations.some(v => v.severity === 'critical')) {
      complianceStatus = 'non_compliant'
    } else if (vendorProfile.compliance.complianceViolations.length > 0) {
      complianceStatus = 'warning'
    }

    const recommendations = this.getQualityRecommendations(vendorProfile)

    return {
      overallScore,
      strengths,
      improvementAreas,
      complianceStatus,
      recommendations
    }
  }
}
