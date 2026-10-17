import { getDefaultStorePriceBounds, type StoreFilterState } from '@/lib/store-constants'

export interface CatalogPriceBounds {
  minPrice: number
  maxPrice: number
  /** False when the catalog filter set has no priceable products. */
  enabled: boolean
  catalogMatchCount: number
}

export function parseProductPrice(product: { price?: string | number | null }): number {
  const raw = product.price
  const price = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '0'))
  return Number.isFinite(price) ? price : 0
}

type CatalogProduct = {
  name: string
  description?: string | null
  category?: string | null
  /** Numeric quantity — preferred when available. */
  stock?: number | null
  /** Boolean fallback when stock quantity is absent (e.g. StoreProduct from adapter). */
  inStock?: boolean
  price?: string | number | null
  vendorId?: string | null
  vendorName?: string | null
  sku?: string | null
  /** Pack-owned payload. `nicheData.search` is extra searchable text (VIN, stock number, ...). */
  nicheData?: Record<string, unknown> | null
}

function nicheSearchText(product: CatalogProduct): string {
  const text = product.nicheData?.search
  return typeof text === 'string' ? text : ''
}

/**
 * One search predicate for every catalog surface (server action and REST route),
 * so a field searchable in one place is searchable in both.
 * `needle` must already be lower-cased.
 */
export function matchesCatalogSearch(product: CatalogProduct, needle: string): boolean {
  if (!needle) return true
  const haystack = [
    product.name,
    product.description || '',
    product.sku || '',
    nicheSearchText(product),
  ]
    .join(' ')
    .toLowerCase()
  const tokens = needle.toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true
  return tokens.every((token) => haystack.includes(token))
}

/** Filters that define the catalog slice used for slider bounds (excludes price). */
export function applyCatalogFilters<T extends CatalogProduct>(
  products: T[],
  filters: Pick<StoreFilterState, 'search' | 'categories' | 'vendor' | 'inStock'>,
): T[] {
  let result = products

  const search = (filters.search || '').toLowerCase()
  if (search) {
    result = result.filter((p) => matchesCatalogSearch(p, search))
  }

  if (filters.categories?.length) {
    result = result.filter((p) => p.category && filters.categories.includes(p.category))
  }

  if (filters.vendor) {
    const needle = filters.vendor.toLowerCase()
    result = result.filter((p) => {
      const vendorId = (p.vendorId || '').toLowerCase()
      const vendorName = (p.vendorName || '').toLowerCase()
      return vendorId.includes(needle) || vendorName.includes(needle)
    })
  }

  if (filters.inStock !== null && filters.inStock !== undefined) {
    result = result.filter((p) => {
      // Prefer numeric stock field; fall back to boolean inStock (adapter-returned products)
      const isAvailable = p.stock != null
        ? p.stock > 0
        : p.inStock === true
      return filters.inStock ? isAvailable : !isAvailable
    })
  }

  return result
}

export function applyPriceFilters<T extends CatalogProduct>(
  products: T[],
  filters: Pick<StoreFilterState, 'priceMin' | 'priceMax'>,
): T[] {
  let result = products

  if (filters.priceMin && filters.priceMin > 0) {
    result = result.filter((p) => parseProductPrice(p) >= filters.priceMin!)
  }
  if (filters.priceMax != null && filters.priceMax > 0) {
    result = result.filter((p) => parseProductPrice(p) <= filters.priceMax!)
  }

  return result
}

/** Min/max from products matching catalog filters (search, categories, vendor, stock). */
export function computeCatalogPriceBounds(
  products: Array<{ price?: string | number | null }>,
): CatalogPriceBounds {
  const defaults = getDefaultStorePriceBounds()

  if (!products.length) {
    return {
      minPrice: defaults.minPrice,
      maxPrice: defaults.maxPrice,
      enabled: false,
      catalogMatchCount: 0,
    }
  }

  let minPrice = Infinity
  let maxPrice = 0
  let priceableCount = 0

  for (const product of products) {
    const price = parseProductPrice(product)
    if (price > 0) {
      priceableCount++
      if (price < minPrice) minPrice = price
      if (price > maxPrice) maxPrice = price
    }
  }

  if (priceableCount === 0) {
    return {
      minPrice: defaults.minPrice,
      maxPrice: defaults.maxPrice,
      enabled: false,
      catalogMatchCount: products.length,
    }
  }

  return {
    minPrice: Math.floor(minPrice),
    maxPrice: Math.ceil(maxPrice),
    enabled: true,
    catalogMatchCount: products.length,
  }
}
