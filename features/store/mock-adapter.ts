import type { StoreAdapter, StoreProduct, CartItem, CheckoutInfo } from './types'

const MOCK_PRODUCTS: StoreProduct[] = [
  { id: 'p1', name: 'DAAR Hoodie', description: 'Cozy zip hoodie', price: '25', currency: 'DAAR', inStock: true },
  { id: 'p2', name: 'DAARION Tee', description: 'Soft cotton tee', price: '12', currency: 'DAARION', inStock: true },
  { id: 'p3', name: 'Sticker Pack', description: 'Laptop sticker set', price: '3', currency: 'DAAR', inStock: true },
]

export class MockStoreAdapter implements StoreAdapter {
  async listProducts(): Promise<StoreProduct[]> {
    return Promise.resolve(MOCK_PRODUCTS)
  }

  async checkout(items: CartItem[], info: CheckoutInfo): Promise<{ orderId: string }> {
    // Simulate processing delay
    await new Promise(r => setTimeout(r, 200))
    const orderId = `ord_${Date.now()}`
    return { orderId }
  }
}



