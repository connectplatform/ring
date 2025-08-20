import { getAdminDb } from '@/lib/firebase-admin.server'
import type { StoreAdapter, StoreProduct, CartItem, CheckoutInfo, Order, OrderItem, OrderTotalsByCurrency } from '../types'

export class FirebaseStoreAdapter implements StoreAdapter {
  async listProducts(): Promise<StoreProduct[]> {
    const db = await getAdminDb()
    const snap = await db.collection('products').get()
    const items: StoreProduct[] = []
    snap.forEach(doc => {
      const d = doc.data() as any
      items.push({
        id: doc.id,
        name: d.name,
        description: d.description,
        price: String(d.price),
        currency: d.currency,
        inStock: Boolean(d.inStock),
      })
    })
    return items
  }

  async checkout(items: CartItem[], info: CheckoutInfo): Promise<{ orderId: string }> {
    const db = await getAdminDb()
    const orderItems: OrderItem[] = items.map(i => ({
      productId: i.product.id,
      name: i.product.name,
      price: i.product.price,
      currency: i.product.currency,
      quantity: i.quantity,
    }))
    const totals: OrderTotalsByCurrency = orderItems.reduce((acc, it) => {
      const key = it.currency
      const price = parseFloat(it.price) * it.quantity
      acc[key] = (acc[key] || 0) + price
      return acc
    }, {} as OrderTotalsByCurrency)

    const now = new Date().toISOString()
    const order: Omit<Order, 'id'> = {
      items: orderItems,
      totals,
      checkoutInfo: info,
      status: 'new',
      createdAt: now,
    }
    const ref = await db.collection('orders').add(order)
    return { orderId: ref.id }
  }
}


