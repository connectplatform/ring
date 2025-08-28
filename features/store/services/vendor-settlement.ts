/**
 * Vendor Settlement Service
 * 
 * Handles automated vendor payouts with tier-based commission calculation.
 * Processes settlements after successful payments and manages payout tracking.
 */

import { logger } from '@/lib/logger'
import { 
  createDocument, 
  updateDocument, 
  getCachedDocument,
  getCachedCollectionAdvanced 
} from '@/lib/services/firebase-service-manager'
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
      logger.info('VendorSettlement: Processing settlements for order', { orderId })
      
      // Get order with settlement data
      const orderDoc = await getCachedDocument('orders', orderId)
      if (!orderDoc || !orderDoc.exists) {
        throw new Error('Order not found')
      }
      
      const order = { id: orderDoc.id, ...orderDoc.data() } as any
      
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
          
          const settlementRef = await createDocument('vendor_settlements', settlementRecord)
          
          logger.info('VendorSettlement: Created settlement record', {
            settlementId: settlementRef.id,
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
            payoutReference: settlementRef.id
          }
          
          processedSettlements.push(processedSettlement)
          
          // Update settlement status
          await updateDocument('vendor_settlements', settlementRef.id, {
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
        await updateDocument('orders', orderId, {
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
      // This will be integrated with the wallet/credit system
      logger.info('VendorSettlement: Updating vendor balance', {
        vendorId,
        amount
      })
      
      // For now, just track in vendor stats
      const vendorDoc = await getCachedDocument('vendor_profiles', vendorId)
      if (vendorDoc && vendorDoc.exists) {
        const currentBalance = (vendorDoc.data() as any)?.pendingBalance || 0
        await updateDocument('vendor_profiles', vendorId, {
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
      const limit = Math.min(options?.limit || 50, 100)
      
      const queryConfig: any = {
        where: [{ field: 'vendorId', operator: '==', value: vendorId }],
        orderBy: [{ field: 'createdAt', direction: 'desc' }],
        limit
      }
      
      if (options?.status) {
        queryConfig.where.push({ field: 'status', operator: '==', value: options.status })
      }
      
      const snapshot = await getCachedCollectionAdvanced('vendor_settlements', queryConfig)
      
      const settlements = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)
      })) as unknown as VendorSettlement[]
      
      return {
        settlements,
        hasMore: snapshot.docs.length === limit
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
      logger.info('VendorSettlement: Starting bulk payout processing', {
        vendorCount: vendorIds?.length || 'all'
      })
      
      // Get pending settlements
      const queryConfig: any = {
        where: [{ field: 'status', operator: '==', value: 'pending' }],
        orderBy: [{ field: 'createdAt', direction: 'asc' }],
        limit: 100
      }
      
      if (vendorIds && vendorIds.length > 0) {
        queryConfig.where.push({ field: 'vendorId', operator: 'in', value: vendorIds })
      }
      
      const snapshot = await getCachedCollectionAdvanced('vendor_settlements', queryConfig)
      
      let processedCount = 0
      let failedCount = 0
      
      for (const doc of snapshot.docs) {
        const settlement = { id: doc.id, ...doc.data() } as any
        
        try {
          // Process individual payout
          await this.updateVendorBalance(settlement.vendorId, settlement.netAmount)
          
          // Mark as completed
          await updateDocument('vendor_settlements', doc.id, {
            status: 'completed',
            processedAt: new Date().toISOString(),
            payoutMethod: 'bulk_processing'
          })
          
          processedCount++
        } catch (error) {
          logger.error('VendorSettlement: Failed to process payout', {
            settlementId: doc.id,
            vendorId: settlement.vendorId,
            error
          })
          failedCount++
        }
      }
      
      logger.info('VendorSettlement: Bulk payout processing completed', {
        processedCount,
        failedCount,
        totalCount: snapshot.docs.length
      })
      
      return {
        success: true,
        processedCount,
        failedCount,
        totalCount: snapshot.docs.length
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
