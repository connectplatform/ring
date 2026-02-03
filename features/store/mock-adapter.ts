import type { StoreAdapter, StoreProduct, CartItem, CheckoutInfo } from './types'

const MOCK_PRODUCTS: StoreProduct[] = [
  { id: 'p1', name: 'DAAR Hoodie', description: 'Cozy zip hoodie', price: '25', currency: 'DAAR', inStock: true },
  { id: 'p2', name: 'DAARION Tee', description: 'Soft cotton tee', price: '12', currency: 'DAARION', inStock: true },
  { id: 'p3', name: 'Sticker Pack', description: 'Laptop sticker set', price: '3', currency: 'DAAR', inStock: true },
  { id: 'f7eed788-2c1c-4750-b5f4-28e762491fc0', name: 'Ring Platform Organic Honey', description: 'Pure organic honey from sustainable apiaries', price: '14.99', currency: 'RING', inStock: true },
]

export class MockStoreAdapter implements StoreAdapter {
  async listProducts(): Promise<StoreProduct[]> {
    return Promise.resolve(MOCK_PRODUCTS)
  }

  async createProduct(productData: Partial<StoreProduct> & { vendorId: string }): Promise<StoreProduct> {
    // Mock implementation for client-side
    const productId = `mock_prod_${Date.now()}`
    const product: StoreProduct = {
      id: productId,
      name: productData.name || 'Mock Product',
      description: productData.description || '',
      price: productData.price || '0',
      currency: (productData.currency as any) || 'USD',
      inStock: true,
      category: productData.category,
      tags: productData.tags || [],
      productListedAt: ['1'],
      productOwner: productData.vendorId,
      ownerEntityId: undefined,
      storeId: '1',
      status: 'active' as any
    }
    return Promise.resolve(product)
  }

  async checkout(items: CartItem[], info: CheckoutInfo): Promise<{ orderId: string }> {
    // Simulate processing delay
    await new Promise(r => setTimeout(r, 200))
    const orderId = `ord_${Date.now()}`
    return { orderId }
  }
}



