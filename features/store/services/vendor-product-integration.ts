/**
 * Vendor-Product Integration Service
 *
 * ERP Extension: Integrates vendor profiles with product listings to enable
 * storefront display of ERP-enhanced product information including quality badges,
 * trust scores, and vendor analytics.
 *
 * NOTE: This service uses server actions to safely access Firebase Admin SDK
 * instead of importing it directly in client-side code.
 */

import type { StoreProduct } from '@/features/store/types'
import type { ExtendedVendorProfile } from '@/features/store/types/vendor'

// Note: EnhancedProduct interface removed - all fields now in StoreProduct

import {
  getEnhancedProducts as getEnhancedProductsServerAction,
  getProductsByVendor as getProductsByVendorServerAction,
  getQualityRecommendations as getQualityRecommendationsServerAction,
  getSustainableProducts as getSustainableProductsServerAction,
  getAIRecommendedProducts as getAIRecommendedProductsServerAction,
  updateProductQualityMetrics as updateProductQualityMetricsServerAction,
  generateProductQualityReport
} from '@/app/_actions/store-erp'

/**
 * Vendor-Product Integration Service
 * Enables storefront to display ERP-enhanced product information
 */
export class VendorProductIntegrationService {
  /**
   * Get enhanced products with vendor information for storefront display
   */
  static async getEnhancedProducts(limit: number = 50): Promise<StoreProduct[]> {
    return getEnhancedProductsServerAction(limit)
  }

  /**
   * Enhance a single product with vendor information
   */
  static enhanceProduct(product: StoreProduct, vendorProfile?: ExtendedVendorProfile): StoreProduct {
    const qualityBadges: string[] = []
    let trustScore = 50 // Default trust score
    let sustainabilityRating: number | undefined
    let aiRecommended = false

    if (vendorProfile) {
      // Quality badges
      if (vendorProfile.compliance?.organicCertified) {
        qualityBadges.push('organic')
      }
      if (vendorProfile.compliance?.fairTradeCertified) {
        qualityBadges.push('fair-trade')
      }
      if (vendorProfile.qualityProfile.qualityScore >= 90) {
        qualityBadges.push('premium-quality')
      }

      // Trust score
      trustScore = vendorProfile.trustScore

      // Sustainability rating
      if (vendorProfile.sustainability) {
        sustainabilityRating = vendorProfile.sustainability.socialImpactScore
      }

      // AI recommendation
      if (vendorProfile.aiInsights?.recommendedActions?.some(
        action => action.toLowerCase().includes('quality') ||
                 action.toLowerCase().includes('premium') ||
                 action.toLowerCase().includes('recommended')
      )) {
        aiRecommended = true
      }
    }

    return {
      ...product,
      vendorProfile,
      qualityBadges,
      trustScore,
      sustainabilityRating,
      aiRecommended,
      complianceStatus: {
        fsma: vendorProfile?.compliance?.fsmaCompliant || false,
        organic: vendorProfile?.compliance?.organicCertified || false,
        fairTrade: vendorProfile?.compliance?.fairTradeCertified || false
      }
    }
  }

  /**
   * Get products by vendor with quality filtering
   */
  static async getProductsByVendor(
    vendorId: string,
    filters?: {
      minQualityScore?: number
      certifiedOnly?: boolean
      minTrustScore?: number
    }
  ): Promise<StoreProduct[]> {
    return getProductsByVendorServerAction(vendorId, filters)
  }

  /**
   * Get quality-focused product recommendations
   */
  static async getQualityRecommendations(limit: number = 10): Promise<StoreProduct[]> {
    return getQualityRecommendationsServerAction(limit)
  }

  /**
   * Get sustainable product recommendations
   */
  static async getSustainableProducts(limit: number = 10): Promise<StoreProduct[]> {
    return getSustainableProductsServerAction(limit)
  }

  /**
   * Get AI-recommended products
   */
  static async getAIRecommendedProducts(limit: number = 10): Promise<StoreProduct[]> {
    return getAIRecommendedProductsServerAction(limit)
  }

  /**
   * Update product quality metrics based on vendor profile changes
   */
  static async updateProductQualityMetrics(vendorId: string): Promise<void> {
    return updateProductQualityMetricsServerAction(vendorId)
  }

  /**
   * Generate product quality report for vendor dashboard
   */
  static generateProductQualityReport(products: StoreProduct[]): {
    totalProducts: number
    qualityDistribution: { excellent: number; good: number; average: number; poor: number }
    topQualityProducts: StoreProduct[]
    certifications: string[]
    averageTrustScore: number
    aiRecommendedCount: number
  } {
    const qualityDistribution = {
      excellent: 0,
      good: 0,
      average: 0,
      poor: 0
    }

    const certifications = new Set<string>()
    let totalTrustScore = 0
    let aiRecommendedCount = 0

    products.forEach(product => {
      // Quality distribution
      const qualityScore = product.vendorProfile?.qualityProfile.qualityScore || 0
      if (qualityScore >= 90) qualityDistribution.excellent++
      else if (qualityScore >= 80) qualityDistribution.good++
      else if (qualityScore >= 60) qualityDistribution.average++
      else qualityDistribution.poor++

      // Certifications
      product.qualityBadges.forEach(badge => certifications.add(badge))

      // Trust score
      totalTrustScore += product.trustScore

      // AI recommendations
      if (product.aiRecommended) aiRecommendedCount++
    })

    // Top quality products
    const topQualityProducts = products
      .sort((a, b) => (b.vendorProfile?.qualityProfile.qualityScore || 0) - (a.vendorProfile?.qualityProfile.qualityScore || 0))
      .slice(0, 5)

    return {
      totalProducts: products.length,
      qualityDistribution,
      topQualityProducts,
      certifications: Array.from(certifications),
      averageTrustScore: products.length > 0 ? totalTrustScore / products.length : 0,
      aiRecommendedCount
    }
  }
}
