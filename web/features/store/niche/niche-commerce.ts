/**
 * L1 stub. Packs overwrite this to change store behavior for a vertical product.
 */
import type { StoreProduct } from '@/features/store/types'

export function nicheSuppressesCart(_product: Pick<StoreProduct, 'nicheData' | 'nichePreset'>): boolean {
  return false
}
