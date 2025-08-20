import type { StoreAdapter, StoreProduct, CartItem, CheckoutInfo } from '../types'
import { MockStoreAdapter } from '../mock-adapter'

/**
 * Placeholder ConnectPlatform adapter.
 * Delegates to MockStoreAdapter until ConnectPlatform SDK store APIs are available.
 */
export class ConnectPlatformStoreAdapter implements StoreAdapter {
  private delegate = new MockStoreAdapter()

  async listProducts(): Promise<StoreProduct[]> {
    return this.delegate.listProducts()
  }

  async checkout(items: CartItem[], info: CheckoutInfo): Promise<{ orderId: string }> {
    return this.delegate.checkout(items, info)
  }
}


