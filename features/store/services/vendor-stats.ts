/**
 * Vendor Statistics Service
 * 
 * Service for calculating and retrieving vendor dashboard statistics
 * Uses React 19 cache() for read operations
 */

import { cache } from 'react'
import { db } from '@/lib/database'
import { VendorProfile, VendorDashboardStats } from '@/features/store/types/vendor'
import { Order } from '@/features/store/types'
import { StoreProduct } from '@/features/store/types'
import { getVendorPendingPayouts, getVendorPayoutHistory } from './settlement'

/**
 * Get comprehensive dashboard statistics for a vendor
 * Cached for performance
 */
export const getVendorDashboardStats = cache(async (entityId: string): Promise<VendorDashboardStats> => {
  try {
    const vendorId = `vendor_${entityId}`
    
    const vendorResult = await db().findDocById<VendorProfile & Record<string, unknown>>(
      'vendorProfiles',
      vendorId
    )
    const vendor = vendorResult.success && vendorResult.data
      ? (vendorResult.data as VendorProfile)
      : null
    
    const orders = await getVendorOrders(entityId)
    const products = await getVendorProducts(entityId)
    
    const { total: pendingPayouts } = await getVendorPendingPayouts(vendorId)
    const payoutHistory = await getVendorPayoutHistory(vendorId, 100)
    const totalCommissionPaid = payoutHistory.reduce((sum, p) => sum + p.commission, 0)
    
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    
    const ordersThisMonth = orders.filter(o => 
      new Date(o.createdAt) >= thisMonthStart
    )
    const ordersLastMonth = orders.filter(o => 
      new Date(o.createdAt) >= lastMonthStart && 
      new Date(o.createdAt) <= lastMonthEnd
    )
    
    const salesThisMonth = calculateTotalSales(ordersThisMonth, entityId)
    const salesLastMonth = calculateTotalSales(ordersLastMonth, entityId)
    const totalSales = calculateTotalSales(orders, entityId)
    
    const activeProducts = products.filter(p => p.status === 'active').length
    const outOfStockProducts = products.filter(p => !p.inStock).length
    
    const totalOrders = orders.length
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0
    const conversionRate = calculateConversionRate(products.length, totalOrders)
    const growthRate = salesLastMonth > 0 
      ? ((salesThisMonth - salesLastMonth) / salesLastMonth) * 100 
      : 0
    
    return {
      totalSales,
      totalOrders,
      averageOrderValue,
      conversionRate,
      trustScore: vendor?.trustScore || 50,
      fulfillmentRate: vendor?.performanceMetrics.orderFulfillmentRate || 100,
      customerSatisfaction: vendor?.performanceMetrics.customerSatisfactionScore || 5,
      pendingPayouts,
      availableBalance: 0,
      totalCommissionPaid,
      totalProducts: products.length,
      activeProducts,
      outOfStockProducts,
      salesThisMonth,
      salesLastMonth,
      growthRate
    }
  } catch (error) {
    console.error('Error calculating vendor stats:', error)
    
    return {
      totalSales: 0,
      totalOrders: 0,
      averageOrderValue: 0,
      conversionRate: 0,
      trustScore: 50,
      fulfillmentRate: 100,
      customerSatisfaction: 5,
      pendingPayouts: 0,
      availableBalance: 0,
      totalCommissionPaid: 0,
      totalProducts: 0,
      activeProducts: 0,
      outOfStockProducts: 0,
      salesThisMonth: 0,
      salesLastMonth: 0,
      growthRate: 0
    }
  }
})

const getVendorOrders = cache(async (entityId: string): Promise<Order[]> => {
  try {
    const result = await db().queryDocs<Order & { id: string }>({
      collection: 'orders',
      filters: [
        { field: 'vendorOrders', operator: 'array-contains', value: { vendorId: entityId } }
      ],
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      pagination: { limit: 1000 }
    })
    
    if (!result.success) {
      return []
    }
    
    return result.data as Order[]
  } catch (error) {
    console.error('Error fetching vendor orders:', error)
    return []
  }
})

const getVendorProducts = cache(async (entityId: string): Promise<StoreProduct[]> => {
  try {
    const result = await db().queryDocs<StoreProduct & { id: string }>({
      collection: 'store_products',
      filters: [
        { field: 'ownerEntityId', operator: '=', value: entityId }
      ]
    })
    
    if (!result.success) {
      return []
    }
    
    return result.data as StoreProduct[]
  } catch (error) {
    console.error('Error fetching vendor products:', error)
    return []
  }
})

function calculateTotalSales(orders: Order[], entityId: string): number {
  return orders.reduce((total, order) => {
    const vendorOrder = order.vendorOrders?.find(vo => vo.vendorId === entityId)
    return total + (vendorOrder?.subtotal || 0)
  }, 0)
}

function calculateConversionRate(totalProducts: number, totalOrders: number): number {
  if (totalProducts === 0) return 0
  return Math.min(100, (totalOrders / (totalProducts * 10)) * 100)
}
