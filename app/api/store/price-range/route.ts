import { NextRequest, NextResponse, connection } from 'next/server'
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService'
import { shouldSkipDatabaseConnect } from '@/lib/build-cache/phase-detector'
import { getDefaultStorePriceBounds, type StoreFilterState } from '@/lib/store-constants'
import {
  applyCatalogFilters,
  computeCatalogPriceBounds,
} from '@/lib/store-price-range'

function parseCatalogFilters(searchParams: URLSearchParams): Pick<
  StoreFilterState,
  'search' | 'categories' | 'vendor' | 'inStock'
> {
  const categories = searchParams.get('categories')
  const inStock = searchParams.get('inStock')
  return {
    search: searchParams.get('search') || '',
    categories: categories ? categories.split(',').filter(Boolean) : [],
    vendor: searchParams.get('vendor') || '',
    inStock:
      inStock === 'true' ? true : inStock === 'false' ? false : null,
  }
}

/**
 * GET /api/store/price-range?search=&categories=&vendor=&inStock=
 * Returns min/max for products matching catalog filters (excludes price slider).
 * Prefer getStoreProducts.priceRange from the store page server action.
 */
export async function GET(request: NextRequest) {
  await connection()
  try {
    if (shouldSkipDatabaseConnect()) {
      const defaults = getDefaultStorePriceBounds()
      return NextResponse.json({
        ...defaults,
        enabled: false,
        catalogMatchCount: 0,
        productCount: 0,
      })
    }

    await initializeDatabase()
    const db = getDatabaseService()
    const catalogFilters = parseCatalogFilters(request.nextUrl.searchParams)

    const result = await db.query({ collection: 'store_products', filters: [] })
    if (!result.success || !result.data) {
      const empty = computeCatalogPriceBounds([])
      return NextResponse.json({ ...empty, productCount: 0 })
    }

    const products = Array.isArray(result.data)
      ? result.data
      : (result.data as { data?: unknown[] }).data || []

    const catalogProducts = applyCatalogFilters(
      products as Parameters<typeof applyCatalogFilters>[0],
      catalogFilters,
    )
    const bounds = computeCatalogPriceBounds(catalogProducts)

    return NextResponse.json({
      ...bounds,
      productCount: bounds.catalogMatchCount,
    })
  } catch (error) {
    console.error('❌ Error fetching price range:', error)
    const defaults = getDefaultStorePriceBounds()
    return NextResponse.json(
      {
        error: 'Failed to fetch price range',
        ...defaults,
        enabled: false,
        catalogMatchCount: 0,
        productCount: 0,
      },
      { status: 500 },
    )
  }
}
