/**
 * Store Filter Constants - Shared across components
 * Single source of truth for filter defaults
 */

export const PRICE_MIN = 0

/** Default store price slider bounds (env overrides; used at build and before DB fetch). */
export function getDefaultStorePriceBounds(): { minPrice: number; maxPrice: number } {
  const minRaw =
    process.env.STORE_DEFAULT_PRICE_MIN ?? process.env.NEXT_PUBLIC_STORE_DEFAULT_PRICE_MIN
  const maxRaw =
    process.env.STORE_DEFAULT_PRICE_MAX ?? process.env.NEXT_PUBLIC_STORE_DEFAULT_PRICE_MAX
  const minPrice = minRaw !== undefined && minRaw !== '' ? Number(minRaw) : PRICE_MIN
  const maxPrice = maxRaw !== undefined && maxRaw !== '' ? Number(maxRaw) : 1000
  return {
    minPrice: Number.isFinite(minPrice) ? minPrice : PRICE_MIN,
    maxPrice: Number.isFinite(maxPrice) && maxPrice > 0 ? maxPrice : 1000,
  }
}

export interface StoreFilterState {
  search: string
  categories: string[]
  priceMin: number
  priceMax: number | null // null = fetch from DB
  currency: string
  vendor: string
  inStock: boolean | null
  sortBy: string
}

export const DEFAULT_STORE_FILTERS: StoreFilterState = {
  search: '',
  categories: [],
  priceMin: PRICE_MIN,
  priceMax: null, // Set from catalog bounds after first product load
  currency: 'UAH',
  vendor: '',
  inStock: null,
  sortBy: 'name-asc'
}

