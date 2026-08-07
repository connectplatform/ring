'use server'

import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { hasMemberPrivileges } from '@/features/auth/user-role'
import { getVendorByUserId } from '@/features/store/services/get-vendor-by-user'
import { getCachedProductCatalog } from '@/features/store/config'
import { StoreFilterState } from '@/lib/store-constants'
import {
  applyCatalogFilters,
  applyPriceFilters,
  computeCatalogPriceBounds,
  type CatalogPriceBounds,
} from '@/lib/store-price-range'
import { computePaginationCursor } from '@/lib/pagination/cursor-pagination'

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
    startAfter?: string
  },
): Promise<StoreProductsResult> {
  try {
    const session = await auth()

    let vendorId = 'vendor_ring_portal_store'
    let vendorName = 'Ring Portal Store'

    if (session?.user) {
      const userRole = session.user.role

      if (isPlatformAdmin(userRole)) {
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

    const allProducts = await getCachedProductCatalog()
    const totalProducts = allProducts.length

    const catalogProducts = applyCatalogFilters(allProducts, filters)
    const priceRange = computeCatalogPriceBounds(catalogProducts)

    let filteredProducts = applyPriceFilters(catalogProducts, filters)

    // ── Audience filter: member-only products are hidden from non-member users.
    // Products tagged with productAudience === 'member' require member privileges
    // (role >= member). Admins see all products regardless of audience tag.
    const currentRole = session?.user?.role
    const isAdmin = currentRole ? isPlatformAdmin(currentRole) : false
    const userHasMemberAccess = isAdmin || hasMemberPrivileges(currentRole)
    if (!userHasMemberAccess) {
      filteredProducts = filteredProducts.filter((product) => {
        const doc = product as unknown as Record<string, unknown>
        const audience = doc.productAudience ?? doc.audience
        // Products with no audience tag or 'public' are visible to all.
        // Products tagged 'member' are hidden from non-member users.
        return audience !== 'member'
      })
    }

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
    const afterId = filters.startAfter ?? filters.afterId
    let paginatedProducts = filteredProducts

    if (afterId) {
      const afterIndex = filteredProducts.findIndex((p) => p.id === afterId)
      if (afterIndex >= 0) {
        paginatedProducts = filteredProducts.slice(afterIndex + 1, afterIndex + 1 + limit)
      } else {
        paginatedProducts = []
      }
    } else {
      paginatedProducts = filteredProducts.slice(0, limit)
    }

    const { nextCursor: lastVisible } = computePaginationCursor(
      paginatedProducts,
      limit,
      (product) => product.id,
    )

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
