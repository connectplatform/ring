/**
 * Vendor Settlement Service
 * 
 * Handles automated vendor payouts with tier-based commission calculation.
 * Processes settlements after successful payments and manages payout tracking.
 * 
 * NOTE: NO cache() - financial mutations require real-time accuracy
 */

import { logger } from '@/lib/logger'
import { initializeDatabase, getDatabaseService } from '@/lib/database'
import type { VendorSettlement } from '@/features/store/types'

export interface SettlementPaymentData {
  paymentMethod: string
  transactionId: string
  amount: number
  currency: string
}

export interface SettlementSummary {
  vendorId: string
  totalSales: number
  totalCommission: number
  netPayout: number
  pendingSettlements: number
  completedSettlements: number
  lastSettlementDate?: string
}

/**
 * Vendor Settlement Service
 */
export const VendorSettlementService = {
  /**
   * Processes vendor settlements after successful payment
   */
  async processSettlements(orderId: string, paymentData: SettlementPaymentData) {
    try {
      await initializeDatabase()
      const db = getDatabaseService()
      
      logger.info('VendorSettlement: Processing settlements for order', { orderId })
      
      // Get order with settlement data
      const orderResult = await db.findById('orders', orderId)
      if (!orderResult.success || !orderResult.data) {
        throw new Error('Order not found')
      }
      
      const orderData = orderResult.data.data || orderResult.data
      const order = { id: orderId, ...orderData } as any
      
      if (!order.vendorSettlements || order.vendorSettlements.length === 0) {
        logger.warn('VendorSettlement: No settlements found for order', { orderId })
        return { success: true, message: 'No settlements to process' }
      }
      
      const processedSettlements: VendorSettlement[] = []
      
      for (const settlement of order.vendorSettlements as VendorSettlement[]) {
        try {
          // Create settlement record
          const settlementRecord = {
            ...settlement,
            orderId,
            paymentMethod: paymentData.paymentMethod,
            paymentTransactionId: paymentData.transactionId,
            status: 'processing' as const,
            createdAt: new Date().toISOString()
          }
          
          const createResult = await db.create('vendor_settlements', settlementRecord)
          
          if (!createResult.success) {
            throw new Error('Failed to create settlement record')
          }
          
          const settlementId = createResult.data?.id || `settlement_${Date.now()}`
          
          logger.info('VendorSettlement: Created settlement record', {
            settlementId,
            vendorId: settlement.vendorId,
            netAmount: settlement.netAmount
          })
          
          // Update vendor balance (will be implemented with wallet integration)
          await this.updateVendorBalance(settlement.vendorId, settlement.netAmount)
          
          // Mark settlement as processed
          const processedSettlement: VendorSettlement = {
            ...settlement,
            status: 'completed',
            processedAt: new Date().toISOString(),
            payoutMethod: 'wallet', // Will be configurable
            payoutReference: settlementId
          }
          
          processedSettlements.push(processedSettlement)
          
          // Update settlement status
          await db.update('vendor_settlements', settlementId, {
            status: 'completed',
            processedAt: new Date().toISOString()
          })
          
        } catch (error) {
          logger.error('VendorSettlement: Failed to process individual settlement', {
            vendorId: (settlement as any).vendorId,
            error
          })
          // Continue processing other settlements
        }
      }
      
      // Update order with processed settlements
      if (processedSettlements.length > 0) {
        await db.update('orders', orderId, {
          vendorSettlements: processedSettlements,
          settlementsProcessedAt: new Date().toISOString()
        })
      }
      
      logger.info('VendorSettlement: Settlements processed successfully', {
        orderId,
        processedCount: processedSettlements.length,
        totalCount: (order.vendorSettlements as any[]).length
      })
      
      return {
        success: true,
        processedCount: processedSettlements.length,
        totalCount: (order.vendorSettlements as any[]).length
      }
      
    } catch (error) {
      logger.error('VendorSettlement: Error processing settlements', {
        orderId,
        error
      })
      throw error
    }
  },

  /**
   * Updates vendor balance (placeholder for wallet integration)
   */
  async updateVendorBalance(vendorId: string, amount: number) {
    try {
      await initializeDatabase()
      const db = getDatabaseService()
      
      // This will be integrated with the wallet/credit system
      logger.info('VendorSettlement: Updating vendor balance', {
        vendorId,
        amount
      })
      
      // For now, just track in vendor stats
      const vendorResult = await db.findById('vendor_profiles', vendorId)
      if (vendorResult.success && vendorResult.data) {
        const vendorData = vendorResult.data.data || vendorResult.data
        const currentBalance = vendorData?.pendingBalance || 0
        await db.update('vendor_profiles', vendorId, {
          pendingBalance: currentBalance + amount,
          lastPayoutUpdate: new Date().toISOString()
        })
      }
      
      return true
    } catch (error) {
      logger.error('VendorSettlement: Failed to update vendor balance', {
        vendorId,
        amount,
        error
      })
      throw error
    }
  },

  /**
   * Gets vendor settlement history
   */
  async getVendorSettlementHistory(vendorId: string, options?: {
    limit?: number
    startAfter?: string
    status?: VendorSettlement['status']
  }) {
    try {
      await initializeDatabase()
      const db = getDatabaseService()
      
      const limit = Math.min(options?.limit || 50, 100)
      
      const filters: any[] = [{ field: 'vendorId', operator: '=', value: vendorId }]
      
      if (options?.status) {
        filters.push({ field: 'status', operator: '=', value: options.status })
      }
      
      const result = await db.query({
        collection: 'vendor_settlements',
        filters,
        orderBy: [{ field: 'createdAt', direction: 'desc' }],
        pagination: { limit }
      })
      
      if (!result.success || !result.data) {
        return { settlements: [], hasMore: false }
      }
      
      const data = Array.isArray(result.data) ? result.data : (result.data as any).data || []
      const settlements = data.map(item => ({
        id: item.id,
        ...(item.data || item)
      })) as VendorSettlement[]
      
      return {
        settlements,
        hasMore: settlements.length === limit
      }
      
    } catch (error) {
      logger.error('VendorSettlement: Error fetching settlement history', {
        vendorId,
        error
      })
      throw error
    }
  },

  /**
   * Gets vendor settlement summary
   */
  async getVendorSettlementSummary(vendorId: string): Promise<SettlementSummary> {
    try {
      const settlementsResult = await this.getVendorSettlementHistory(vendorId, { limit: 100 })
      const settlements = settlementsResult.settlements
      
      let totalSales = 0
      let totalCommission = 0
      let netPayout = 0
      let pendingCount = 0
      let completedCount = 0
      let lastSettlementDate: string | undefined
      
      for (const settlement of settlements) {
        totalSales += settlement.subtotal || 0
        totalCommission += settlement.commission || 0
        netPayout += settlement.netAmount || 0
        
        if (settlement.status === 'pending' || settlement.status === 'processing') {
          pendingCount++
        } else if (settlement.status === 'completed') {
          completedCount++
          if (!lastSettlementDate || (settlement.processedAt && settlement.processedAt > lastSettlementDate)) {
            lastSettlementDate = settlement.processedAt
          }
        }
      }
      
      return {
        vendorId,
        totalSales,
        totalCommission,
        netPayout,
        pendingSettlements: pendingCount,
        completedSettlements: completedCount,
        lastSettlementDate
      }
      
    } catch (error) {
      logger.error('VendorSettlement: Error calculating settlement summary', {
        vendorId,
        error
      })
      throw error
    }
  },

  /**
   * Processes bulk vendor payouts (admin function)
   */
  async processBulkPayouts(vendorIds?: string[]) {
    try {
      await initializeDatabase()
      const db = getDatabaseService()
      
      logger.info('VendorSettlement: Starting bulk payout processing', {
        vendorCount: vendorIds?.length || 'all'
      })
      
      // Get pending settlements
      const filters: any[] = [{ field: 'status', operator: '=', value: 'pending' }]
      
      if (vendorIds && vendorIds.length > 0) {
        filters.push({ field: 'vendorId', operator: 'in', value: vendorIds })
      }
      
      const result = await db.query({
        collection: 'vendor_settlements',
        filters,
        orderBy: [{ field: 'createdAt', direction: 'asc' }],
        pagination: { limit: 100 }
      })
      
      if (!result.success || !result.data) {
        return { processedCount: 0, failedCount: 0 }
      }
      
      const settlements = Array.isArray(result.data) ? result.data : (result.data as any).data || []
      let processedCount = 0
      let failedCount = 0
      
      for (const item of settlements) {
        const settlement = { id: item.id, ...(item.data || item) } as any
        
        try {
          // Process individual payout
          await this.updateVendorBalance(settlement.vendorId, settlement.netAmount)
          
          // Mark as completed
          await db.update('vendor_settlements', settlement.id, {
            status: 'completed',
            processedAt: new Date().toISOString(),
            payoutMethod: 'bulk_processing'
          })
          
          processedCount++
        } catch (error) {
          logger.error('VendorSettlement: Failed to process payout', {
            settlementId: settlement.id,
            vendorId: settlement.vendorId,
            error
          })
          failedCount++
        }
      }
      
      logger.info('VendorSettlement: Bulk payout processing completed', {
        processedCount,
        failedCount,
        totalCount: settlements.length
      })
      
      return {
        success: true,
        processedCount,
        failedCount,
        totalCount: settlements.length
      }
      
    } catch (error) {
      logger.error('VendorSettlement: Error processing bulk payouts', error)
      throw error
    }
  },

  /**
   * Calculates commission rate based on vendor tier
   */
  getCommissionRate(vendorTier: string): number {
    const rates: Record<string, number> = {
      'NEW': 20,
      'BASIC': 18,
      'VERIFIED': 16,
      'TRUSTED': 14,
      'PREMIUM': 12
    }
    return rates[vendorTier] || 20
  }
}
