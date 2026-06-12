/**
 * Vendor Settlement Service
 *
 * Delegates commission math to settlement.ts (calculateCommission / createSettlement)
 * and writes the canonical `settlements` ledger via settlement-pipeline.
 */

import { logger } from '@/lib/logger'
import { db } from '@/lib/database'
import type { StoreOrder, VendorSettlement } from '@/features/store/types'
import { STORE_COLLECTIONS } from '@/features/store/constants/collections'
import { recordSettlementsForPaidOrder } from '@/features/store/services/settlement-pipeline'
import {
  getVendorPayoutHistory,
  getVendorPendingPayouts,
  type Settlement,
} from '@/features/store/services/settlement'

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

export const VendorSettlementService = {
  async processSettlements(orderId: string, paymentData: SettlementPaymentData) {
    try {
      logger.info('VendorSettlement: Processing settlements for order', { orderId })

      const orderResult = await db().findDocById<StoreOrder & { id: string }>(
        STORE_COLLECTIONS.orders,
        orderId
      )
      if (!orderResult.success || !orderResult.data) {
        throw new Error('Order not found')
      }

      const order = orderResult.data as StoreOrder

      if (!order.vendorSettlements || order.vendorSettlements.length === 0) {
        logger.warn('VendorSettlement: No settlements found for order', { orderId })
        return { success: true, message: 'No settlements to process' }
      }

      const { created, skipped } = await recordSettlementsForPaidOrder(order)

      const processedSettlements: VendorSettlement[] = order.vendorSettlements.map((vs) => ({
        ...vs,
        status: 'completed',
        processedAt: new Date().toISOString(),
        payoutMethod: paymentData.paymentMethod,
        payoutReference: `settlement_${orderId}_${vs.vendorEntityId || vs.vendorId}`,
      }))

      if (created > 0 || skipped > 0) {
        await db().updateDoc(STORE_COLLECTIONS.orders, orderId, {
          vendorSettlements: processedSettlements,
          settlementsProcessedAt: new Date().toISOString(),
        })
      }

      logger.info('VendorSettlement: Settlements processed successfully', {
        orderId,
        created,
        skipped,
        totalCount: order.vendorSettlements.length,
      })

      return {
        success: true,
        processedCount: created,
        skippedCount: skipped,
        totalCount: order.vendorSettlements.length,
      }
    } catch (error) {
      logger.error('VendorSettlement: Error processing settlements', { orderId, error })
      throw error
    }
  },

  async updateVendorBalance(vendorId: string, amount: number) {
    try {
      logger.info('VendorSettlement: Updating vendor balance', { vendorId, amount })

      const entityId = vendorId.replace(/^vendor_/, '')
      const profileId = `vendor_${entityId}`
      const vendorResult = await db().findDocById<Record<string, unknown>>(
        STORE_COLLECTIONS.vendorProfiles,
        profileId
      )
      if (vendorResult.success && vendorResult.data) {
        const currentBalance = (vendorResult.data.pendingBalance as number) || 0
        await db().updateDoc(STORE_COLLECTIONS.vendorProfiles, profileId, {
          pendingBalance: currentBalance + amount,
          lastPayoutUpdate: new Date().toISOString(),
        })
      }

      return true
    } catch (error) {
      logger.error('VendorSettlement: Failed to update vendor balance', { vendorId, amount, error })
      throw error
    }
  },

  async getVendorSettlementHistory(
    vendorId: string,
    options?: {
      limit?: number
      startAfter?: string
      status?: VendorSettlement['status']
    },
  ) {
    try {
      const limit = Math.min(options?.limit || 50, 100)
      const history = await getVendorPayoutHistory(vendorId, limit)
      const entityId = vendorId.replace(/^vendor_/, '')

      const settlements = history
        .filter((s) => !options?.status || s.status === options.status)
        .map(
          (s: Settlement): VendorSettlement => ({
            vendorId: entityId,
            vendorEntityId: entityId,
            productIds: [],
            subtotal: s.amount,
            commission: s.commission,
            commissionRate: 0,
            netAmount: s.netPayout,
            status: s.status === 'completed' ? 'completed' : 'pending',
            processedAt: s.processedAt,
            payoutReference: s.id,
          }),
        )

      return { settlements, hasMore: settlements.length === limit }
    } catch (error) {
      logger.error('VendorSettlement: Error fetching settlement history', { vendorId, error })
      throw error
    }
  },

  async getVendorSettlementSummary(vendorId: string): Promise<SettlementSummary> {
    try {
      const pending = await getVendorPendingPayouts(vendorId)
      const history = await getVendorPayoutHistory(vendorId, 100)

      let totalSales = 0
      let totalCommission = 0
      let netPayout = 0
      let lastSettlementDate: string | undefined

      for (const s of history) {
        totalSales += s.amount
        totalCommission += s.commission
        netPayout += s.netPayout
        if (s.processedAt && (!lastSettlementDate || s.processedAt > lastSettlementDate)) {
          lastSettlementDate = s.processedAt
        }
      }

      return {
        vendorId,
        totalSales,
        totalCommission,
        netPayout,
        pendingSettlements: pending.settlements.length,
        completedSettlements: history.length,
        lastSettlementDate,
      }
    } catch (error) {
      logger.error('VendorSettlement: Error calculating settlement summary', { vendorId, error })
      throw error
    }
  },

  async processBulkPayouts(vendorIds?: string[]) {
    const { processDueSettlements } = await import('@/features/store/services/settlement')
    const batch = await processDueSettlements()
    return {
      success: true,
      processedCount: batch?.completedCount ?? 0,
      failedCount: batch?.failedCount ?? 0,
      totalCount: batch?.settlements?.length ?? 0,
      vendorIds,
    }
  },

  getCommissionRate(vendorTier: string): number {
    const rates: Record<string, number> = {
      NEW: 20,
      BASIC: 18,
      VERIFIED: 16,
      TRUSTED: 14,
      PREMIUM: 12,
    }
    return rates[vendorTier] || 20
  },
}
