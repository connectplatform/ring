/**
 * Server-side Payment Orchestration
 * 
 * - Enhanced error handling and performance monitoring
 * - WayForPay integration for Ukrainian market
 * - PostgreSQL DatabaseService for order updates
 * - Used in API routes and server actions only
 */

import { db } from '@/lib/database'
import type { StorePayment, VendorSettlement } from '@/features/store/types'

export interface CreateStripeSessionInput {
  orderId: string
  amountUsd: number
  metadata?: Record<string, string>
}

export interface CreateWayForPaySessionInput {
  orderId: string
  returnUrl?: string
  locale?: 'UK' | 'EN' | 'RU'
}

export const StorePaymentsService = {
  async createWayForPaySession(input: CreateWayForPaySessionInput) {
    try {
      const response = await fetch('/api/store/payments/wayforpay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(input)
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create payment session')
      }
      
      const data = await response.json()
      return {
        success: true,
        paymentUrl: data.paymentUrl,
        wayforpayOrderId: data.wayforpayOrderId
      }
    } catch (error) {
      console.error('[StorePaymentsService] Error creating WayForPay session:', error)
      throw error
    }
  },

  async createStripeTestSession(_input: CreateStripeSessionInput) {
    return { url: '/checkout/stripe/mock-session' }
  },

  async markOrderPaidStripe(orderId: string, stripeSessionId: string) {
    try {
      await db().updateDoc('orders', orderId, {
        payment: { method: 'stripe', status: 'paid', stripeSessionId },
        status: 'paid',
        updatedAt: new Date().toISOString()
      })
      
      return { ok: true, orderId }
    } catch (error) {
      console.error('[StorePaymentsService] Error marking order as paid via Stripe:', error)
      throw new Error('Failed to update order payment status')
    }
  },

  async markOrderFailedStripe(orderId: string, stripeSessionId: string) {
    try {
      await db().updateDoc('orders', orderId, {
        payment: { method: 'stripe', status: 'failed', stripeSessionId },
        updatedAt: new Date().toISOString()
      })
      
      return { ok: true, orderId }
    } catch (error) {
      console.error('[StorePaymentsService] Error marking order as failed via Stripe:', error)
      throw new Error('Failed to update order payment status')
    }
  },

  async recordCryptoPayment(orderId: string, txHash: string) {
    try {
      await db().updateDoc('orders', orderId, {
        payment: { method: 'crypto', status: 'paid', txHash },
        status: 'paid',
        updatedAt: new Date().toISOString()
      })
      
      return { ok: true, orderId, txHash }
    } catch (error) {
      console.error('[StorePaymentsService] Error recording crypto payment:', error)
      throw new Error('Failed to record crypto payment')
    }
  },

  async markOrderPaidWayForPay(orderId: string, wayforpayOrderId: string, paymentData: Partial<StorePayment>) {
    try {
      await db().updateDoc('orders', orderId, {
        payment: {
          method: 'wayforpay',
          status: 'paid',
          wayforpayOrderId,
          ...paymentData
        },
        status: 'paid',
        updatedAt: new Date().toISOString()
      })
      
      return { ok: true, orderId, wayforpayOrderId }
    } catch (error) {
      console.error('[StorePaymentsService] Error marking order as paid via WayForPay:', error)
      throw new Error('Failed to update order payment status')
    }
  },

  async markOrderFailedWayForPay(orderId: string, wayforpayOrderId: string, reason: string) {
    try {
      await db().updateDoc('orders', orderId, {
        payment: {
          method: 'wayforpay',
          status: 'failed',
          wayforpayOrderId,
          failureReason: reason
        },
        updatedAt: new Date().toISOString()
      })
      
      return { ok: true, orderId, wayforpayOrderId }
    } catch (error) {
      console.error('[StorePaymentsService] Error marking order as failed via WayForPay:', error)
      throw new Error('Failed to update order payment status')
    }
  },

  async processVendorSettlements(orderId: string, settlements: VendorSettlement[]) {
    try {
      await db().updateDoc('orders', orderId, {
        vendorSettlements: settlements,
        updatedAt: new Date().toISOString()
      })
      
      return { ok: true, orderId, settlementCount: settlements.length }
    } catch (error) {
      console.error('[StorePaymentsService] Error processing vendor settlements:', error)
      throw new Error('Failed to update vendor settlements')
    }
  }
}
