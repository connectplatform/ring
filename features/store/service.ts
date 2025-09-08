import type { StoreAdapter, StoreProduct, CartItem, CheckoutInfo } from './types'
import { VendorProductIntegrationService, type EnhancedProduct } from './services/vendor-product-integration'

export class RingStoreService {
  private adapter: StoreAdapter

  constructor(adapter: StoreAdapter) {
    this.adapter = adapter
  }

  /**
   * ERP Extension: Get enhanced products with vendor quality data
   */
  async listEnhanced(): Promise<EnhancedProduct[]> {
    try {
      return await VendorProductIntegrationService.getEnhancedProducts()
    } catch (error) {
      console.error('Error getting enhanced products, falling back to basic products:', error)
      // Fallback to basic products if enhancement fails
      const basicProducts = await this.list()
      return basicProducts.map(product => ({
        ...product,
        qualityBadges: [],
        trustScore: 50,
        aiRecommended: false,
        complianceStatus: {
          fsma: false,
          organic: false,
          fairTrade: false
        }
      }))
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  async list(): Promise<StoreProduct[]> {
    return this.adapter.listProducts()
  }

  /**
   * ERP Extension: Get quality-focused product recommendations
   */
  async getQualityRecommendations(limit: number = 10): Promise<EnhancedProduct[]> {
    return VendorProductIntegrationService.getQualityRecommendations(limit)
  }

  /**
   * ERP Extension: Get sustainable product recommendations
   */
  async getSustainableProducts(limit: number = 10): Promise<EnhancedProduct[]> {
    return VendorProductIntegrationService.getSustainableProducts(limit)
  }

  /**
   * ERP Extension: Get AI-recommended products
   */
  async getAIRecommendedProducts(limit: number = 10): Promise<EnhancedProduct[]> {
    return VendorProductIntegrationService.getAIRecommendedProducts(limit)
  }

  async checkout(items: CartItem[], info: CheckoutInfo) {
    return this.adapter.checkout(items, info)
  }
}


