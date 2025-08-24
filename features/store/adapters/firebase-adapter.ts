// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager with React 19 cache() for request deduplication
// - Enhanced error handling and performance monitoring
// - Build-time phase detection and intelligent caching strategies

import { getCachedCollection, createDocument } from '@/lib/services/firebase-service-manager'
import type { StoreAdapter, StoreProduct, CartItem, CheckoutInfo, Order, OrderItem, OrderTotalsByCurrency } from '../types'

export class FirebaseStoreAdapter implements StoreAdapter {
  async listProducts(): Promise<StoreProduct[]> {
    try {
      // Use cached collection query for improved performance
      const snapshot = await getCachedCollection('products', {
        orderBy: { field: 'name', direction: 'asc' }
      })
      
      const items: StoreProduct[] = []
      snapshot.forEach(doc => {
        const data = doc.data() as any
        items.push({
          id: doc.id,
          name: data.name,
          description: data.description,
          price: String(data.price),
          currency: data.currency,
          inStock: Boolean(data.inStock),
        })
      })
      
      return items
    } catch (error) {
      console.error('[FirebaseStoreAdapter] Error listing products:', error)
      throw new Error('Failed to retrieve products')
    }
  }

  async checkout(items: CartItem[], info: CheckoutInfo): Promise<{ orderId: string }> {
    try {
      const orderItems: OrderItem[] = items.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        price: item.product.price,
        currency: item.product.currency,
        quantity: item.quantity,
      }))
      
      const totals: OrderTotalsByCurrency = orderItems.reduce((acc, item) => {
        const currency = item.currency
        const price = parseFloat(item.price) * item.quantity
        acc[currency] = (acc[currency] || 0) + price
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
      
      // Use optimized document creation with automatic error handling
      const docRef = await createDocument('orders', order)
      return { orderId: docRef.id }
    } catch (error) {
      console.error('[FirebaseStoreAdapter] Error during checkout:', error)
      throw new Error('Failed to process checkout')
    }
  }
}


