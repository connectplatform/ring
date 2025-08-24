// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Direct optimized function calls instead of service manager wrapper
// - Enhanced error handling and performance monitoring
// - Build-time phase detection and intelligent caching strategies

import { z } from 'zod'
import { orderCreateSchema } from '@/lib/zod'
import { 
  getCachedDocument, 
  getCachedCollectionAdvanced, 
  createDocument, 
  updateDocument,
  getUserOrders 
} from '@/lib/services/firebase-service-manager'

export const StoreOrdersService = {
  async listOrdersForUser(userId: string, opts?: { limit?: number; startAfter?: string }) {
    try {
      const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100)
      
      // Use optimized getUserOrders function from firebase-service-manager
      const snapshot = await getUserOrders(userId, undefined, limit)
      
      const items = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }))
      
      const lastVisible = snapshot.docs.length > 0 
        ? snapshot.docs[snapshot.docs.length - 1].id 
        : null
        
      return { items, lastVisible }
    } catch (error) {
      console.error('[StoreOrdersService] Error listing user orders:', error)
      throw new Error('Failed to retrieve user orders')
    }
  },

  async getOrderById(id: string) {
    try {
      const doc = await getCachedDocument('orders', id)
      if (!doc || !doc.exists) return null
      
      return { id: doc.id, ...doc.data() }
    } catch (error) {
      console.error('[StoreOrdersService] Error getting order by ID:', error)
      throw new Error('Failed to retrieve order')
    }
  },

  async createOrder(userId: string, data: z.infer<typeof orderCreateSchema>) {
    try {
      const now = new Date().toISOString()
      const orderData = { 
        ...data, 
        userId, 
        status: data.status || 'new', 
        createdAt: now 
      }
      
      const docRef = await createDocument('orders', orderData)
      return { orderId: docRef.id }
    } catch (error) {
      console.error('[StoreOrdersService] Error creating order:', error)
      throw new Error('Failed to create order')
    }
  },

  async adminListAllOrders(opts?: { 
    limit?: number; 
    startAfter?: string; 
    statusFilter?: 'new' | 'paid' | 'processing' | 'shipped' | 'completed' | 'canceled';
  }) {
    try {
      const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100)
      
      // Build query configuration
      const queryConfig: any = {
        orderBy: [{ field: 'createdAt', direction: 'desc' }],
        limit
      }
      
      // Apply status filter if provided
      if (opts?.statusFilter) {
        queryConfig.where = [{ field: 'status', operator: '==', value: opts.statusFilter }]
      }
      
      // TODO: Implement pagination with startAfter for advanced collection queries
      // This would require enhancing getCachedCollectionAdvanced to support document cursors
      
      const snapshot = await getCachedCollectionAdvanced('orders', queryConfig)
      
      const items = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }))
      
      const lastVisible = snapshot.docs.length > 0 
        ? snapshot.docs[snapshot.docs.length - 1].id 
        : null
        
      return { items, lastVisible }
    } catch (error) {
      console.error('[StoreOrdersService] Error listing all orders:', error)
      throw new Error('Failed to retrieve orders')
    }
  },

  async adminUpdateOrderStatus(id: string, status: 'new' | 'paid' | 'processing' | 'shipped' | 'completed' | 'canceled') {
    try {
      await updateDocument('orders', id, { 
        status, 
        updatedAt: new Date().toISOString() 
      })
      
      return true
    } catch (error) {
      console.error('[StoreOrdersService] Error updating order status:', error)
      throw new Error('Failed to update order status')
    }
  }
}

