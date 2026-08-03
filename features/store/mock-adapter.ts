import type { StoreAdapter, StoreProduct, CartItem, CheckoutInfo } from './types'
import { getMainCurrencySymbol, getNativeTokenSymbol } from '@/lib/ring-config-core'

const mainCurrency = getMainCurrencySymbol()
const nativeToken = getNativeTokenSymbol()

const MOCK_PRODUCTS: StoreProduct[] = [
  {
    id: 'p1',
    name: `${nativeToken} Hoodie`,
    description: 'Cozy zip hoodie',
    price: '25',
    currency: nativeToken as StoreProduct['currency'],
    inStock: true,
  },
  {
    id: 'p2',
    name: 'Platform Tee',
    description: 'Soft cotton tee',
    price: '12',
    currency: mainCurrency as StoreProduct['currency'],
    inStock: true,
  },
  {
    id: 'p3',
    name: 'Sticker Pack',
    description: 'Laptop sticker set',
    price: '3',
    currency: mainCurrency as StoreProduct['currency'],
    inStock: true,
  },
  {
    id: 'f7eed788-2c1c-4750-b5f4-28e762491fc0',
    name: 'Ring Platform Organic Honey',
    description: 'Pure organic honey from sustainable apiaries',
    price: '14.99',
    currency: mainCurrency as StoreProduct['currency'],
    inStock: true,
  },
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
      price: productData.price?.toString() || '0',
      currency: (productData.currency || mainCurrency) as StoreProduct['currency'],
      inStock: productData.inStock ?? true,
      category: productData.category,
      tags: productData.tags || [],
      productOwner: productData.vendorId,
      storeId: '1',
      status: 'active' as StoreProduct['status'],
    }
    MOCK_PRODUCTS.push(product)
    return product
  }

  async checkout(_items: CartItem[], _info: CheckoutInfo): Promise<{ orderId: string }> {
    return { orderId: `mock_order_${Date.now()}` }
  }
}
