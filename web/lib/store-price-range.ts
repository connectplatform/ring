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
}

/** Filters that define the catalog slice used for slider bounds (excludes price). */
export function applyCatalogFilters<T extends CatalogProduct>(
  products: T[],
  filters: Pick<StoreFilterState, 'search' | 'categories' | 'vendor' | 'inStock'>,
): T[] {
  let result = products

  const search = (filters.search || '').toLowerCase()
  if (search) {
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(search) ||
        (p.description || '').toLowerCase().includes(search),
    )
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
