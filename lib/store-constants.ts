/**
 * Store Filter Constants - Shared across components
 * Single source of truth for filter defaults
 */

export const PRICE_MIN = 0

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
  priceMax: null, // Will be fetched from DB/cache
  currency: 'UAH',
  vendor: '',
  inStock: null,
  sortBy: 'name-asc'
}

