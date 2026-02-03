/**
 * Vendor Statistics Service
 * 
 * Service for calculating and retrieving vendor dashboard statistics
 * Uses React 19 cache() for read operations
 */

import { cache } from 'react'
import { initializeDatabase, getDatabaseService } from '@/lib/database'
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
    await initializeDatabase()
    const db = getDatabaseService()
    
    const vendorId = `vendor_${entityId}`
    
    // Get vendor profile
    const vendorResult = await db.findById('vendorProfiles', vendorId)
    const vendor = vendorResult.success && vendorResult.data 
      ? (vendorResult.data.data || vendorResult.data) as VendorProfile
      : null
    
    // Get orders for this vendor
    const orders = await getVendorOrders(entityId)
    
    // Get products for this vendor
    const products = await getVendorProducts(entityId)
    
    // Get pending payouts
    const { total: pendingPayouts } = await getVendorPendingPayouts(vendorId)
    
    // Get payout history for commission calculation
    const payoutHistory = await getVendorPayoutHistory(vendorId, 100)
    const totalCommissionPaid = payoutHistory.reduce((sum, p) => sum + p.commission, 0)
    
    // Calculate sales metrics
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
    
    // Calculate product metrics
    const activeProducts = products.filter(p => p.status === 'active').length
    const outOfStockProducts = products.filter(p => !p.inStock).length
    
    // Calculate performance metrics
    const totalOrders = orders.length
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0
    const conversionRate = calculateConversionRate(products.length, totalOrders)
    const growthRate = salesLastMonth > 0 
      ? ((salesThisMonth - salesLastMonth) / salesLastMonth) * 100 
      : 0
    
    return {
      // Sales
      totalSales,
      totalOrders,
      averageOrderValue,
      conversionRate,
      
      // Performance
      trustScore: vendor?.trustScore || 50,
      fulfillmentRate: vendor?.performanceMetrics.orderFulfillmentRate || 100,
      customerSatisfaction: vendor?.performanceMetrics.customerSatisfactionScore || 5,
      
      // Financial
      pendingPayouts,
      availableBalance: 0, // Would need wallet integration
      totalCommissionPaid,
      
      // Products
      totalProducts: products.length,
      activeProducts,
      outOfStockProducts,
      
      // Time-based metrics
      salesThisMonth,
      salesLastMonth,
      growthRate
    }
  } catch (error) {
    console.error('Error calculating vendor stats:', error)
    
    // Return default stats on error
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

/**
 * Get orders for a vendor
 * Cached for performance
 */
const getVendorOrders = cache(async (entityId: string): Promise<Order[]> => {
  try {
    const db = getDatabaseService()
    const result = await db.query({
      collection: 'orders',
      filters: [
        { field: 'vendorOrders', operator: 'array-contains', value: { vendorId: entityId } }
      ],
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      pagination: { limit: 1000 }
    })
    
    if (!result.success || !result.data) {
      return []
    }
    
    const orders = Array.isArray(result.data) ? result.data : (result.data as any).data || []
    return orders
  } catch (error) {
    console.error('Error fetching vendor orders:', error)
    return []
  }
})

/**
 * Get products for a vendor
 * Cached for performance
 */
const getVendorProducts = cache(async (entityId: string): Promise<StoreProduct[]> => {
  try {
    const db = getDatabaseService()
    const result = await db.query({
      collection: 'store_products',
      filters: [
        { field: 'ownerEntityId', operator: '=', value: entityId }
      ]
    })
    
    if (!result.success || !result.data) {
      return []
    }
    
    const products = Array.isArray(result.data) ? result.data : (result.data as any).data || []
    return products
  } catch (error) {
    console.error('Error fetching vendor products:', error)
    return []
  }
})

/**
 * Calculate total sales from orders
 */
function calculateTotalSales(orders: Order[], entityId: string): number {
  return orders.reduce((total, order) => {
    const vendorOrder = order.vendorOrders?.find(vo => vo.vendorId === entityId)
    return total + (vendorOrder?.subtotal || 0)
  }, 0)
}

/**
 * Calculate conversion rate
 */
function calculateConversionRate(totalProducts: number, totalOrders: number): number {
  if (totalProducts === 0) return 0
  // Simplified calculation - in reality would need view/click data
  return Math.min(100, (totalOrders / (totalProducts * 10)) * 100)
}
