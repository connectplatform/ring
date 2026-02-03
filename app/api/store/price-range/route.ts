import { NextResponse } from 'next/server'
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService'

/**
 * GET /api/store/price-range
 * Returns the realistic price range from products in database
 * Caches result in store_settings table for performance
 */
export async function GET() {
  try {
    await initializeDatabase()
    const db = getDatabaseService()
    
    // Try to get cached value first (< 1 hour old)
    const cachedResult = await db.findById('store_settings', 'price_range')
    
    if (cachedResult.success && cachedResult.data) {
      const cached = cachedResult.data as any
      const cacheAge = Date.now() - new Date(cached.updated_at).getTime()
      
      // Use cache if less than 1 hour old
      if (cacheAge < 60 * 60 * 1000) {
        console.log('💾 Using cached price range:', cached.value)
        return NextResponse.json(cached.value)
      }
    }
    
    // Calculate fresh price range from products
    const result = await db.query({ collection: 'store_products', filters: [] })
    
    if (!result.success || !result.data) {
      console.warn('⚠️ No products found for price range calculation')
      // Return sensible default for empty store (not hardcoded fallback)
      const emptyRange = { minPrice: 0, maxPrice: 1000, productCount: 0 }
      return NextResponse.json(emptyRange)
    }
    
    const products = Array.isArray(result.data) ? result.data : (result.data as any).data || []
    
    // Calculate actual min and max prices
    let minPrice = Infinity
    let maxPrice = 0
    
    for (const product of products) {
      const price = product.price || 0
      if (price > 0) {
        if (price < minPrice) minPrice = price
        if (price > maxPrice) maxPrice = price
      }
    }
    
    // If no valid prices found, use 0-1000 range
    if (minPrice === Infinity) minPrice = 0
    if (maxPrice === 0) maxPrice = 1000
    
    const priceRange = {
      minPrice: Math.floor(minPrice),
      maxPrice: Math.ceil(maxPrice),
      productCount: products.length
    }
    
    console.log('💰 Calculated fresh price range:', priceRange)
    
    // Cache the result in store_settings
    await db.update('store_settings', 'price_range', {
        id: 'price_range',
        value: priceRange,
        updated_at: new Date().toISOString()
    })
    
    return NextResponse.json(priceRange)
    
  } catch (error) {
    console.error('❌ Error fetching price range:', error)
    // Emergency fallback only for catastrophic errors
    return NextResponse.json(
      { 
        error: 'Failed to fetch price range',
        minPrice: 0,
        maxPrice: 1000,
        productCount: 0
      },
      { status: 500 }
    )
  }
}
