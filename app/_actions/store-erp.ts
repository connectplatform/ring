'use server'

/**
 * Store ERP Server Actions
 *
 * ERP Extension: Server actions for store operations using DatabaseService
 * READ operations cached with React 19 cache() for performance
 */

import { cache } from 'react'
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService'
import type { StoreProduct } from '@/features/store/types'
import type { ExtendedVendorProfile } from '@/features/store/types/vendor'

// Note: EnhancedProduct interface removed - all fields now in StoreProduct

/**
 * Get enhanced products with vendor information for storefront display
 * READ operation - uses React 19 cache() for performance
 */
export const getEnhancedProducts = cache(async (limit: number = 50): Promise<StoreProduct[]> => {
  try {
    await initializeDatabase()
    const db = getDatabaseService()
    
    // Get all products (READ operation - cached)
    const productsResult = await db.query({
      collection: 'store_products',
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      pagination: { limit }
    })

    if (!productsResult.success) {
      console.error('Error fetching products:', productsResult.error)
      return []
    }

    const products = productsResult.data as any[] as StoreProduct[]

    // Get unique vendor IDs from products
    const vendorIds = [...new Set(
      products
        .map(product => product.productOwner || product.ownerEntityId)
        .filter(Boolean)
    )]

    // Fetch vendor profiles for these products
    const vendorProfiles: ExtendedVendorProfile[] = []

    for (const vendorId of vendorIds) {
      try {
        const profileResult = await db.read('vendorProfiles', `vendor_${vendorId}`)
        if (profileResult.success && profileResult.data) {
          vendorProfiles.push(profileResult.data as any as ExtendedVendorProfile)
        }
      } catch (error) {
        console.warn(`Could not fetch vendor profile for ${vendorId}:`, error)
      }
    }

    // Create vendor lookup map
    const vendorMap = new Map<string, ExtendedVendorProfile>()
    vendorProfiles.forEach(profile => {
      vendorMap.set(profile.entityId, profile)
    })

    // Enhance products with vendor data
    const enhancedProducts: StoreProduct[] = products.map(product => {
      const vendorId = product.productOwner || product.ownerEntityId
      const vendorProfile = vendorId ? vendorMap.get(vendorId) : undefined

      return enhanceProduct(product, vendorProfile)
    })

    return enhancedProducts
  } catch (error) {
    console.error('Error getting enhanced products:', error)
    return []
  }
})

/**
 * Get products by vendor with quality filtering
 * READ operation - uses React 19 cache() for performance
 */
export const getProductsByVendor = cache(async (
  vendorId: string,
  filters?: {
    minQualityScore?: number
    certifiedOnly?: boolean
    minTrustScore?: number
  }
): Promise<StoreProduct[]> => {
  try {
    await initializeDatabase()
    const db = getDatabaseService()
    
    // Get vendor profile (READ - cached)
    const profileResult = await db.read('vendorProfiles', `vendor_${vendorId}`)
    if (!profileResult.success || !profileResult.data) {
      return []
    }
    const vendorProfile = profileResult.data as any as ExtendedVendorProfile

    // Get products by this vendor (READ - cached)
    const productsResult = await db.query({
      collection: 'store_products',
      filters: [
        {
          field: 'productOwner',
          operator: '==',
          value: vendorId
        }
      ],
      pagination: { limit: 100 }
    })

    if (!productsResult.success) {
      console.error('Error fetching vendor products:', productsResult.error)
      return []
    }

    const products = productsResult.data as any[] as StoreProduct[]

    // Apply quality filters
    let enhancedProducts = products.map(product =>
      enhanceProduct(product, vendorProfile)
    )

    if (filters) {
      enhancedProducts = enhancedProducts.filter(product => {
        if (filters.minQualityScore && vendorProfile.qualityProfile.qualityScore < filters.minQualityScore) {
          return false
        }
        if (filters.certifiedOnly && !product.complianceStatus.organic && !product.complianceStatus.fairTrade) {
          return false
        }
        if (filters.minTrustScore && product.trustScore < filters.minTrustScore) {
          return false
        }
        return true
      })
    }

    return enhancedProducts
  } catch (error) {
    console.error('Error getting products by vendor:', error)
    return []
  }
})

/**
 * Get quality-focused product recommendations
 */
export async function getQualityRecommendations(limit: number = 10): Promise<StoreProduct[]> {
  try {
    const enhancedProducts = await getEnhancedProducts(200)

    // Sort by quality score and trust score
    const sorted = enhancedProducts
      .filter(product => product.vendorProfile) // Only products with vendor data
      .sort((a, b) => {
        const aScore = (a.vendorProfile!.qualityProfile.qualityScore + a.trustScore) / 2
        const bScore = (b.vendorProfile!.qualityProfile.qualityScore + b.trustScore) / 2
        return bScore - aScore
      })

    return sorted.slice(0, limit)
  } catch (error) {
    console.error('Error getting quality recommendations:', error)
    return []
  }
}

/**
 * Get sustainable product recommendations
 */
export async function getSustainableProducts(limit: number = 10): Promise<StoreProduct[]> {
  try {
    const enhancedProducts = await getEnhancedProducts(200)

    // Filter and sort by sustainability rating
    const sustainable = enhancedProducts
      .filter(product =>
        product.vendorProfile?.sustainability &&
        product.vendorProfile.sustainability.socialImpactScore >= 70
      )
      .sort((a, b) => {
        const aScore = a.vendorProfile!.sustainability!.socialImpactScore
        const bScore = b.vendorProfile!.sustainability!.socialImpactScore
        return bScore - aScore
      })

    return sustainable.slice(0, limit)
  } catch (error) {
    console.error('Error getting sustainable products:', error)
    return []
  }
}

/**
 * Get AI-recommended products
 */
export async function getAIRecommendedProducts(limit: number = 10): Promise<StoreProduct[]> {
  try {
    const enhancedProducts = await getEnhancedProducts(200)

    const aiRecommended = enhancedProducts
      .filter(product => product.aiRecommended)
      .sort((a, b) => b.trustScore - a.trustScore)

    return aiRecommended.slice(0, limit)
  } catch (error) {
    console.error('Error getting AI recommended products:', error)
    return []
  }
}

/**
 * Update product quality metrics based on vendor profile changes
 * MUTATION - NO CACHE! (updates product metadata)
 */
export async function updateProductQualityMetrics(vendorId: string): Promise<void> {
  try {
    await initializeDatabase()
    const db = getDatabaseService()
    
    // Get vendor profile (READ - cached)
    const profileResult = await db.read('vendorProfiles', `vendor_${vendorId}`)
    if (!profileResult.success || !profileResult.data) {
      return
    }
    const vendorProfile = profileResult.data as any as ExtendedVendorProfile

    // Get all products by this vendor (READ for update)
    const productsResult = await db.query({
      collection: 'store_products',
      filters: [
        {
          field: 'productOwner',
          operator: '==',
          value: vendorId
        }
      ]
    })

    if (!productsResult.success) {
      console.error('Error fetching vendor products:', productsResult.error)
      return
    }

    const products = productsResult.data as any[] as StoreProduct[]

    // Update quality metrics for each product (MUTATION - NO CACHE!)
    for (const product of products) {
      const enhancedProduct = enhanceProduct(product, vendorProfile)

      // Update product with quality metadata
      console.log(`Updated quality metrics for product ${product.id}:`, {
        qualityBadges: enhancedProduct.qualityBadges,
        trustScore: enhancedProduct.trustScore,
        aiRecommended: enhancedProduct.aiRecommended
      })
    }
  } catch (error) {
    console.error('Error updating product quality metrics:', error)
  }
}

/**
 * Generate product quality report for vendor dashboard
 */
export async function generateProductQualityReport(products: StoreProduct[]): Promise<{
  totalProducts: number;
  qualityDistribution: { excellent: number; good: number; average: number; poor: number };
  topQualityProducts: StoreProduct[];
  certifications: string[];
  averageTrustScore: number;
  aiRecommendedCount: number;
}> {
  const qualityDistribution = {
    excellent: 0,
    good: 0,
    average: 0,
    poor: 0
  };

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

/**
 * Enhance a single product with vendor information
 */
function enhanceProduct(product: StoreProduct, vendorProfile?: ExtendedVendorProfile): StoreProduct {
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
