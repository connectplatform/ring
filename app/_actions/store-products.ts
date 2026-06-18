'use server'

import { auth } from '@/auth'
import { UserRole } from '@/features/auth/types'
import { getVendorByUserId } from '@/features/store/services/get-vendor-by-user'
import { getStoreAdapter } from '@/features/store/config'
import { StoreFilterState } from '@/lib/store-constants'
import {
  applyCatalogFilters,
  applyPriceFilters,
  computeCatalogPriceBounds,
  type CatalogPriceBounds,
} from '@/lib/store-price-range'

export interface StoreProductsResult {
  success: boolean
  items?: any[]
  total?: number
  filteredTotal?: number
  lastVisible?: string | null
  error?: string
  vendorId?: string
  vendorName?: string
  /** Bounds from the current catalog slice (excludes price slider filters). */
  priceRange?: CatalogPriceBounds
}

export async function getStoreProducts(
  filters: StoreFilterState & {
    limit?: number
    afterId?: string
  },
): Promise<StoreProductsResult> {
  try {
    const session = await auth()

    let vendorId = 'vendor_ring_portal_store'
    let vendorName = 'Ring Portal Store'

    if (session?.user) {
      const userRole = session.user.role

      if (userRole === UserRole.admin || userRole === UserRole.superadmin) {
        vendorId = 'vendor_ring_portal_store'
        vendorName = 'Ring Portal Store'
      } else {
        try {
          const vendorLookup = await getVendorByUserId(
            session.user.id,
            session.user.email || undefined,
          )

          if (vendorLookup.found && vendorLookup.isApproved) {
            vendorId = vendorLookup.vendorId!
            vendorName = vendorLookup.vendorName!
          }
        } catch {
          // Public browsing continues
        }
      }
    }

    const adapter = await getStoreAdapter()
    if (!adapter) {
      return { success: false, error: 'Store adapter not available' }
    }

    const allProducts = await adapter.listProducts()
    const totalProducts = allProducts.length

    const catalogProducts = applyCatalogFilters(allProducts, filters)
    const priceRange = computeCatalogPriceBounds(catalogProducts)

    let filteredProducts = applyPriceFilters(catalogProducts, filters)

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
        case 'newest': {
          const aDate = a.productListedAt?.[0] || '0'
          const bDate = b.productListedAt?.[0] || '0'
          return new Date(bDate).getTime() - new Date(aDate).getTime()
        }
        case 'oldest': {
          const aDateOld = a.productListedAt?.[0] || '0'
          const bDateOld = b.productListedAt?.[0] || '0'
          return new Date(aDateOld).getTime() - new Date(bDateOld).getTime()
        }
        default:
          return 0
      }
    })

    const limit = filters.limit || 24
    const afterId = filters.afterId
    let paginatedProducts = filteredProducts
    let lastVisible: string | null = null

    if (afterId) {
      const afterIndex = filteredProducts.findIndex((p) => p.id === afterId)
      if (afterIndex >= 0) {
        paginatedProducts = filteredProducts.slice(afterIndex + 1, afterIndex + 1 + limit)
      }
    } else {
      paginatedProducts = filteredProducts.slice(0, limit)
    }

    if (
      paginatedProducts.length === limit &&
      filteredProducts.length >
        (afterId ? filteredProducts.findIndex((p) => p.id === afterId) + 1 + limit : limit)
    ) {
      lastVisible = paginatedProducts[paginatedProducts.length - 1].id
    }

    return {
      success: true,
      items: paginatedProducts,
      total: totalProducts,
      filteredTotal: filteredProducts.length,
      lastVisible,
      vendorId,
      vendorName,
      priceRange,
    }
  } catch (error: unknown) {
    console.error('Store products error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load products',
    }
  }
}
