/**
 * L1 stub — platform store has no niche filters.
 * L2 packs overwrite this module with vertical query params and a predicate.
 */

import type { StoreProduct } from '@/features/store/types'
import type { NicheFacet } from '@/features/store/niche/niche-facets'

/** URL search-param names a pack wants forwarded into `StoreFilterState.niche`. */
export const NICHE_FILTER_PARAMS: string[] = []

export function applyNicheFilters<T extends Pick<StoreProduct, 'id'>>(
  products: T[],
  _niche: Record<string, string> | undefined,
): T[] {
  return products
}

/** Packs overwrite this. Null means the store has no vertical facets. */
export function computeNicheFacets(
  _products: ReadonlyArray<Pick<StoreProduct, 'nicheData'>>,
): NicheFacet[] | null {
  return null
}
