import type { StoreAdapter, StoreProduct, CartItem, CheckoutInfo } from '../types'

export class HttpStoreAdapter implements StoreAdapter {
  async listProducts(): Promise<StoreProduct[]> {
    const res = await fetch('/api/store/products', { cache: 'no-store' })
    if (!res.ok) throw new Error('Failed to load products')
    const data = await res.json()
    return Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : [])
  }

  async checkout(items: CartItem[], info: CheckoutInfo): Promise<{ orderId: string }> {
    const res = await fetch('/api/store/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, info })
    })
    if (!res.ok) throw new Error('Checkout failed')
    return res.json()
  }
}


