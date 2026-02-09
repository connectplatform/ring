'use server'

import { auth } from '@/auth'
import { UserRole } from '@/features/auth/types'
import { getVendorByUserId } from '@/features/store/services/get-vendor-by-user'
import { getStoreAdapter } from '@/features/store/config'
import { StoreFilterState } from '@/lib/store-constants'

export interface StoreProductsResult {
  success: boolean
  items?: any[]
  total?: number
  filteredTotal?: number
  lastVisible?: string | null
  error?: string
  vendorId?: string
  vendorName?: string
  // Price range for UI components (calculated from actual products)
  priceRange?: {
    minPrice: number
    maxPrice: number
  }
}

export async function getStoreProducts(
  filters: StoreFilterState & {
    limit?: number
    afterId?: string
  }
): Promise<StoreProductsResult> {

  try {
    // Public store browsing - no authentication required
    // Authentication is only needed for vendor-specific operations like adding products
    const session = await auth()
    
    // Default to public store view
    let vendorId = 'vendor_ring_portal_store'
    let vendorName = 'Ring Portal Store'
    
    // If user is authenticated, customize view based on role
    if (session?.user) {
      const userRole = session.user.role
      
      // Admin/Superadmin: Use Ring Portal Store
      if (userRole === UserRole.ADMIN || userRole === UserRole.SUPERADMIN) {
        vendorId = 'vendor_ring_portal_store'
        vendorName = 'Ring Portal Store'
      } else {
        // Regular authenticated users: Check vendor profile for personalization
        // but don't block access - they can still browse
        try {
          const vendorLookup = await getVendorByUserId(session.user.id, session.user.email || undefined)
          
          if (vendorLookup.found && vendorLookup.isApproved) {
            vendorId = vendorLookup.vendorId!
            vendorName = vendorLookup.vendorName!
          }
          // If not approved, they can still browse the public store
        } catch {
          // Ignore vendor lookup errors - allow public browsing
        }
      }
    }

    // Get store adapter
    const adapter = await getStoreAdapter()
    if (!adapter) {
      return { success: false, error: 'Store adapter not available' }
    }

    // Get all products for this vendor
    let allProducts = await adapter.listProducts()
    const totalProducts = allProducts.length

    // Apply filters (same logic as API route)
    let filteredProducts = allProducts

    // Filter by search
    const search = (filters.search || '').toLowerCase()
    if (search) {
      filteredProducts = filteredProducts.filter(p =>
        p.name.toLowerCase().includes(search) ||
        (p.description || '').toLowerCase().includes(search)
      )
    }

    // Filter by categories
    if (filters.categories && filters.categories.length > 0) {
      filteredProducts = filteredProducts.filter(p =>
        p.category && filters.categories!.includes(p.category)
      )
    }

    // Filter by price range
    if (filters.priceMin && filters.priceMin > 0) {
      filteredProducts = filteredProducts.filter(p => {
        const price = parseFloat(p.price || '0')
        return price >= filters.priceMin!
      })
    }
    if (filters.priceMax && filters.priceMax > 0) {
      filteredProducts = filteredProducts.filter(p => {
        const price = parseFloat(p.price || '0')
        return price <= filters.priceMax!
      })
    }

    // Filter by stock status
    if (filters.inStock !== null && filters.inStock !== undefined) {
      filteredProducts = filteredProducts.filter(p => {
        const stockQty = p.stock || 0
        return filters.inStock ? stockQty > 0 : stockQty <= 0
      })
    }

    // Apply sorting
    const sortBy = filters.sortBy || 'name-asc'
    filteredProducts.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name)
        case 'name-desc':
          return b.name.localeCompare(a.name)
        case 'price-asc':
          return parseFloat(a.price || '0') - parseFloat(b.price || '0')
        case 'price-desc':
          return parseFloat(b.price || '0') - parseFloat(a.price || '0')
        case 'newest':
          // Use productListedAt as fallback for created date
          const aDate = a.productListedAt?.[0] || '0'
          const bDate = b.productListedAt?.[0] || '0'
          return new Date(bDate).getTime() - new Date(aDate).getTime()
        case 'oldest':
          const aDateOld = a.productListedAt?.[0] || '0'
          const bDateOld = b.productListedAt?.[0] || '0'
          return new Date(aDateOld).getTime() - new Date(bDateOld).getTime()
        default:
          return 0
      }
    })

    // Apply pagination
    const limit = filters.limit || 24
    const afterId = filters.afterId
    let paginatedProducts = filteredProducts
    let lastVisible = null

    if (afterId) {
      const afterIndex = filteredProducts.findIndex(p => p.id === afterId)
      if (afterIndex >= 0) {
        paginatedProducts = filteredProducts.slice(afterIndex + 1, afterIndex + 1 + limit)
      }
    } else {
      paginatedProducts = filteredProducts.slice(0, limit)
    }

    if (paginatedProducts.length === limit && filteredProducts.length > (afterId ?
        filteredProducts.findIndex(p => p.id === afterId) + 1 + limit : limit)) {
      lastVisible = paginatedProducts[paginatedProducts.length - 1].id
    }

    return {
      success: true,
      items: paginatedProducts,
      total: totalProducts,
      filteredTotal: filteredProducts.length,
      lastVisible,
      vendorId,
      vendorName
    }

  } catch (error: any) {
    console.error('Store products error:', error)
    return {
      success: false,
      error: error.message || 'Failed to load products'
    }
  }
}
