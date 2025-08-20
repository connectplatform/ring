import type { StoreAdapter, StoreProduct, CartItem, CheckoutInfo } from './types'

export class RingStoreService {
  private adapter: StoreAdapter

  constructor(adapter: StoreAdapter) {
    this.adapter = adapter
  }

  async list(): Promise<StoreProduct[]> {
    return this.adapter.listProducts()
  }

  async checkout(items: CartItem[], info: CheckoutInfo) {
    return this.adapter.checkout(items, info)
  }
}


