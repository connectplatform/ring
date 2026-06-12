/**
 * Store Orders Service
 *
 * Domain service for order lifecycle (create, list, status, payments).
 * React 19 cache() for read operations; no cache() for mutations.
 */

import { z } from 'zod'
import { cache } from 'react'
import { orderCreateSchema } from '@/lib/zod'
import { db } from '@/lib/database'
import type { Order, StoreOrder, StorePayment, VendorSettlement } from '@/features/store/types'

type OrderRow = Order & Record<string, unknown> & { id: string }
type StoreOrderRow = StoreOrder & Record<string, unknown> & { id: string }

export const StoreOrdersService = {
  listOrdersForUser: cache(async (userId: string, opts?: { limit?: number; startAfter?: string }) => {
    try {
      const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100)
      
      const result = await db().queryDocs<OrderRow>({
        collection: 'orders',
        filters: [{ field: 'userId', operator: '=', value: userId }],
        orderBy: [{ field: 'createdAt', direction: 'desc' }],
        pagination: { limit }
      })
      
      if (!result.success) {
        return { items: [], lastVisible: null }
      }
      
      const items = result.data
      const lastVisible = items.length > 0 ? items[items.length - 1].id : null
        
      return { items, lastVisible }
    } catch (error) {
      console.error('[StoreOrdersService] Error listing user orders:', error)
      throw new Error('Failed to retrieve user orders')
    }
  }),

  getOrderById: cache(async (id: string): Promise<Order | null> => {
    try {
      const result = await db().findDocById<OrderRow>('orders', id)
      if (!result.success || !result.data) return null
      
      return result.data as Order
    } catch (error) {
      console.error('[StoreOrdersService] Error getting order by ID:', error)
      throw new Error('Failed to retrieve order')
    }
  }),

  async createOrder(
    userId: string,
    data: z.infer<typeof orderCreateSchema>,
    referral?: { referralCode?: string; referrerUserId?: string; referrerWallet?: string }
  ) {
    try {
      const now = new Date().toISOString()
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const orderData = { 
        ...data, 
        userId, 
        status: data.status || 'new', 
        createdAt: now,
        ...(referral?.referralCode ? { referralCode: referral.referralCode } : {}),
        ...(referral?.referrerUserId ? { referrerUserId: referral.referrerUserId } : {}),
        ...(referral?.referrerWallet ? { referrerWallet: referral.referrerWallet } : {}),
      }
      
      const result = await db().createDoc('orders', orderData, { id: orderId })
      if (!result.success) {
        throw new Error('Failed to create order')
      }
      
      return { orderId }
    } catch (error) {
      console.error('[StoreOrdersService] Error creating order:', error)
      throw new Error('Failed to create order')
    }
  },

  listOrdersForVendor: cache(async (vendorEntityId: string, opts?: { limit?: number }) => {
    try {
      const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100)

      const result = await db().queryDocs<OrderRow>({
        collection: 'orders',
        orderBy: [{ field: 'createdAt', direction: 'desc' }],
        pagination: { limit: 200 },
      })

      if (!result.success) {
        return { items: [], lastVisible: null }
      }

      const items = result.data
        .filter((order) =>
          Array.isArray(order.vendorSettlements) &&
          (order.vendorSettlements as VendorSettlement[]).some(
            (s) => s.vendorId === vendorEntityId || (s as { vendorEntityId?: string }).vendorEntityId === vendorEntityId
          ),
        )
        .slice(0, limit)

      return { items, lastVisible: items.length > 0 ? items[items.length - 1].id : null }
    } catch (error) {
      console.error('[StoreOrdersService] Error listing vendor orders:', error)
      return { items: [], lastVisible: null }
    }
  }),

  adminListAllOrders: cache(async (opts?: { 
    limit?: number; 
    startAfter?: string; 
    statusFilter?: 'new' | 'paid' | 'processing' | 'shipped' | 'completed' | 'canceled';
  }) => {
    try {
      const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100)
      
      const filters: { field: string; operator: string; value: unknown }[] = []
      if (opts?.statusFilter) {
        filters.push({ field: 'status', operator: '=', value: opts.statusFilter })
      }
      
      const result = await db().queryDocs<OrderRow>({
        collection: 'orders',
        filters,
        orderBy: [{ field: 'createdAt', direction: 'desc' }],
        pagination: { limit }
      })
      
      if (!result.success) {
        return { items: [], lastVisible: null }
      }
      
      const items = result.data
      const lastVisible = items.length > 0 ? items[items.length - 1].id : null
        
      return { items, lastVisible }
    } catch (error) {
      console.error('[StoreOrdersService] Error listing all orders:', error)
      throw new Error('Failed to retrieve orders')
    }
  }),

  async adminUpdateOrderStatus(id: string, status: 'new' | 'paid' | 'processing' | 'shipped' | 'completed' | 'canceled') {
    try {
      await db().updateDoc('orders', id, {
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
      await db().updateDoc('orders', id, {
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
      await db().updateDoc('orders', id, {
        vendorSettlements: settlements,
        updatedAt: new Date().toISOString()
      })
      
      return true
    } catch (error) {
      console.error('[StoreOrdersService] Error updating order settlements:', error)
      throw new Error('Failed to update order settlements')
    }
  },

  getOrderWithPaymentDetails: cache(async (id: string): Promise<StoreOrder | null> => {
    try {
      const result = await db().findDocById<StoreOrderRow>('orders', id)
      if (!result.success || !result.data) return null
      
      const orderData = { ...result.data } as StoreOrder
      
      if (!orderData.payment) {
        orderData.payment = {
          method: 'wayforpay',
          status: 'pending',
          amount: Number(orderData.total ?? 0),
          currency: String((result.data as Record<string, unknown>).currency ?? 'UAH'),
        } satisfies StorePayment
      }
      
      return orderData
    } catch (error) {
      console.error('[StoreOrdersService] Error getting order with payment details:', error)
      throw new Error('Failed to retrieve order payment details')
    }
  })
}
