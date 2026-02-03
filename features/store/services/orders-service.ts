/**
 * Store Orders Service
 * 
 * PostgreSQL DatabaseService for all order operations
 * React 19 cache() for read operations
 * No cache() for mutations (order state changes)
 */

import { z } from 'zod'
import { cache } from 'react'
import { orderCreateSchema } from '@/lib/zod'
import { initializeDatabase, getDatabaseService } from '@/lib/database'
import type { StorePayment, VendorSettlement } from '@/features/store/types'

export const StoreOrdersService = {
  listOrdersForUser: cache(async (userId: string, opts?: { limit?: number; startAfter?: string }) => {
    try {
      await initializeDatabase()
      const db = getDatabaseService()
      
      const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100)
      
      const result = await db.query({
        collection: 'orders',
        filters: [{ field: 'userId', operator: '=', value: userId }],
        orderBy: [{ field: 'createdAt', direction: 'desc' }],
        pagination: { limit }
      })
      
      if (!result.success || !result.data) {
        return { items: [], lastVisible: null }
      }
      
      const data = Array.isArray(result.data) ? result.data : (result.data as any).data || []
      const items = data.map(item => ({
        id: item.id,
        ...(item.data || item)
      }))
      
      const lastVisible = items.length > 0 ? items[items.length - 1].id : null
        
      return { items, lastVisible }
    } catch (error) {
      console.error('[StoreOrdersService] Error listing user orders:', error)
      throw new Error('Failed to retrieve user orders')
    }
  }),

  getOrderById: cache(async (id: string) => {
    try {
      await initializeDatabase()
      const db = getDatabaseService()
      
      const result = await db.findById('orders', id)
      if (!result.success || !result.data) return null
      
      const data = result.data.data || result.data
      return { id, ...data }
    } catch (error) {
      console.error('[StoreOrdersService] Error getting order by ID:', error)
      throw new Error('Failed to retrieve order')
    }
  }),

  async createOrder(userId: string, data: z.infer<typeof orderCreateSchema>) {
    try {
      await initializeDatabase()
      const db = getDatabaseService()
      
      const now = new Date().toISOString()
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const orderData = { 
        ...data, 
        userId, 
        status: data.status || 'new', 
        createdAt: now 
      }
      
      const result = await db.create('orders', orderData, { id: orderId })
      if (!result.success) {
        throw new Error('Failed to create order')
      }
      
      return { orderId }
    } catch (error) {
      console.error('[StoreOrdersService] Error creating order:', error)
      throw new Error('Failed to create order')
    }
  },

  adminListAllOrders: cache(async (opts?: { 
    limit?: number; 
    startAfter?: string; 
    statusFilter?: 'new' | 'paid' | 'processing' | 'shipped' | 'completed' | 'canceled';
  }) => {
    try {
      await initializeDatabase()
      const db = getDatabaseService()
      
      const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100)
      
      const filters: any[] = []
      if (opts?.statusFilter) {
        filters.push({ field: 'status', operator: '=', value: opts.statusFilter })
      }
      
      const result = await db.query({
        collection: 'orders',
        filters,
        orderBy: [{ field: 'createdAt', direction: 'desc' }],
        pagination: { limit }
      })
      
      if (!result.success || !result.data) {
        return { items: [], lastVisible: null }
      }
      
      const data = Array.isArray(result.data) ? result.data : (result.data as any).data || []
      const items = data.map(item => ({
        id: item.id,
        ...(item.data || item)
      }))
      
      const lastVisible = items.length > 0 ? items[items.length - 1].id : null
        
      return { items, lastVisible }
    } catch (error) {
      console.error('[StoreOrdersService] Error listing all orders:', error)
      throw new Error('Failed to retrieve orders')
    }
  }),

  async adminUpdateOrderStatus(id: string, status: 'new' | 'paid' | 'processing' | 'shipped' | 'completed' | 'canceled') {
    try {
      await initializeDatabase()
      const db = getDatabaseService()
      
      await db.update('orders', id, { 
        status, 
        updatedAt: new Date().toISOString() 
      })
      
      return true
    } catch (error) {
      console.error('[StoreOrdersService] Error updating order status:', error)
      throw new Error('Failed to update order status')
    }
  },

  async updateOrderPaymentStatus(id: string, paymentData: StorePayment) {
    try {
      await initializeDatabase()
      const db = getDatabaseService()
      
      await db.update('orders', id, {
        payment: paymentData,
        updatedAt: new Date().toISOString()
      })
      
      return true
    } catch (error) {
      console.error('[StoreOrdersService] Error updating order payment status:', error)
      throw new Error('Failed to update order payment status')
    }
  },

  async updateOrderSettlements(id: string, settlements: VendorSettlement[]) {
    try {
      await initializeDatabase()
      const db = getDatabaseService()
      
      await db.update('orders', id, {
        vendorSettlements: settlements,
        updatedAt: new Date().toISOString()
      })
      
      return true
    } catch (error) {
      console.error('[StoreOrdersService] Error updating order settlements:', error)
      throw new Error('Failed to update order settlements')
    }
  },

  getOrderWithPaymentDetails: cache(async (id: string) => {
    try {
      await initializeDatabase()
      const db = getDatabaseService()
      
      const result = await db.findById('orders', id)
      if (!result.success || !result.data) return null
      
      const data = result.data.data || result.data
      const orderData: any = { id, ...data }
      
      // Ensure payment data is included
      if (!orderData.payment) {
        orderData.payment = {
          method: 'wayforpay',
          status: 'pending'
        }
      }
      
      return orderData
    } catch (error) {
      console.error('[StoreOrdersService] Error getting order with payment details:', error)
      throw new Error('Failed to retrieve order payment details')
    }
  })
}

