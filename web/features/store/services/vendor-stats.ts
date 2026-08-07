/**
 * Vendor Statistics Service
 * 
 * Service for calculating and retrieving vendor dashboard statistics
 * Uses React 19 cache() for read operations
 */

import { cache } from 'react'
import { db } from '@/lib/database'
import { VendorProfile, VendorDashboardStats } from '@/features/store/types/vendor'
import { Order, StoreProduct, VendorSettlement } from '@/features/store/types'
import { VendorTrustLevel } from '@/constants/store'
import { getVendorPendingPayouts, getVendorPayoutHistory } from './settlement'
import { StoreOrdersService } from './orders-service'
import { getVendorProfile } from './vendor-profile'

const DEFAULT_PERFORMANCE = {
  orderFulfillmentRate: 100,
  onTimeShipmentRate: 100,
  customerSatisfactionScore: 5,
  returnProcessingTime: 24,
  totalOrders: 0,
  totalRevenue: 0,
}

const DEFAULT_COMPLIANCE = {
  taxDocumentsSubmitted: false,
  termsAccepted: false,
  dataProcessingAgreementSigned: false,
}

/** Normalize seed/legacy trust levels (NEW → new) to VendorTrustLevel. */
export function normalizeTrustLevel(raw?: string | null): VendorTrustLevel {
  const key = String(raw || 'new').toLowerCase()
  const values = Object.values(VendorTrustLevel) as string[]
  if (values.includes(key)) return key as VendorTrustLevel
  return VendorTrustLevel.NEW
}

/** Ensure VendorDashboard can render incomplete seed profiles safely. */
export function withVendorProfileDefaults(
  profile: VendorProfile | null,
  entityId: string,
  userId?: string,
): VendorProfile {
  const now = new Date().toISOString()
  if (!profile) {
    return {
      id: `vendor_${entityId}`,
      entityId,
      userId: userId || '',
      onboardingStatus: 'approved' as VendorProfile['onboardingStatus'],
      onboardingStartedAt: now,
      trustLevel: VendorTrustLevel.NEW,
      trustScore: 50,
      performanceMetrics: { ...DEFAULT_PERFORMANCE },
      complianceStatus: { ...DEFAULT_COMPLIANCE },
      suspensionHistory: [],
      tierProgressionHistory: [],
      createdAt: now,
      updatedAt: now,
    }
  }

  return {
    ...profile,
    trustLevel: normalizeTrustLevel(profile.trustLevel as unknown as string),
    trustScore: typeof profile.trustScore === 'number' ? profile.trustScore : 50,
    performanceMetrics: {
      ...DEFAULT_PERFORMANCE,
      ...(profile.performanceMetrics || {}),
    },
    complianceStatus: {
      ...DEFAULT_COMPLIANCE,
      ...(profile.complianceStatus || {}),
    },
    suspensionHistory: profile.suspensionHistory || [],
    tierProgressionHistory: profile.tierProgressionHistory || [],
  }
}

/**
 * Get comprehensive dashboard statistics for a vendor
 * Cached for performance
 */
export const getVendorDashboardStats = cache(async (entityId: string): Promise<VendorDashboardStats> => {
  try {
    // SSOT: same profile lookup as earnings/products (vendor_${entityId})
    const vendor = withVendorProfileDefaults(await getVendorProfile(entityId), entityId)

    // SSOT: same order filter as /vendor/orders
    const { items: orders } = await StoreOrdersService.listOrdersForVendor(entityId, { limit: 1000 })
    const products = await getVendorProducts(entityId)

    // SSOT: earnings page passes raw entity id (not vendor_${entityId})
    const { total: pendingPayouts } = await getVendorPendingPayouts(entityId)
    const payoutHistory = await getVendorPayoutHistory(entityId, 100)
    const totalCommissionPaid = payoutHistory.reduce((sum, p) => sum + (p.commission || 0), 0)

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

    const salesThisMonth = calculateTotalSales(ordersThisMonth as Order[], entityId)
    const salesLastMonth = calculateTotalSales(ordersLastMonth as Order[], entityId)
    const totalSales = calculateTotalSales(orders as Order[], entityId)

    const activeProducts = products.filter(p => p.status === 'active').length
    const outOfStockProducts = products.filter(p => {
      const stock = typeof p.stock === 'number' ? p.stock : (p as { stock_quantity?: number }).stock_quantity
      if (typeof stock === 'number') return stock <= 0
      return p.inStock === false
    }).length

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
      trustScore: vendor.trustScore || 50,
      fulfillmentRate: vendor.performanceMetrics.orderFulfillmentRate || 100,
      customerSatisfaction: vendor.performanceMetrics.customerSatisfactionScore || 5,
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

const getVendorProducts = cache(async (entityId: string): Promise<StoreProduct[]> => {
  try {
    // Prefer entity_id (canonical vendor product field); also accept vendorId
    const byEntity = await db().queryDocs<StoreProduct & { id: string }>({
      collection: 'store_products',
      filters: [{ field: 'entity_id', operator: '==', value: entityId }],
      pagination: { limit: 200 },
    })

    if (byEntity.success && byEntity.data?.length) {
      return byEntity.data as StoreProduct[]
    }

    const byVendorId = await db().queryDocs<StoreProduct & { id: string }>({
      collection: 'store_products',
      filters: [{ field: 'vendorId', operator: '==', value: entityId }],
      pagination: { limit: 200 },
    })

    if (!byVendorId.success) {
      return []
    }

    return (byVendorId.data || []) as StoreProduct[]
  } catch (error) {
    console.error('Error fetching vendor products:', error)
    return []
  }
})

function calculateTotalSales(orders: Order[], entityId: string): number {
  return orders.reduce((total, order) => {
    const settlements = (order as Order & { vendorSettlements?: VendorSettlement[] }).vendorSettlements
    if (Array.isArray(settlements) && settlements.length) {
      const match = settlements.find(
        (s) => s.vendorId === entityId || s.vendorEntityId === entityId,
      )
      if (match) {
        return total + (typeof match.subtotal === 'number' ? match.subtotal : match.netAmount || 0)
      }
    }

    const vendorOrder = order.vendorOrders?.find(vo => vo.vendorId === entityId)
    return total + (vendorOrder?.subtotal || 0)
  }, 0)
}

function calculateConversionRate(totalProducts: number, totalOrders: number): number {
  if (totalProducts === 0) return 0
  return Math.min(100, (totalOrders / (totalProducts * 10)) * 100)
}
