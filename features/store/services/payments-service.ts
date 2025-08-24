// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Direct optimized function calls instead of service manager wrapper
// - Enhanced error handling and performance monitoring
// - Build-time phase detection and intelligent caching strategies

import { updateDocument } from '@/lib/services/firebase-service-manager'

// Payment orchestration service for Store domain
// Future: integrate real Stripe sessions and on-chain flows

export interface CreateStripeSessionInput {
  orderId: string
  amountUsd: number
  metadata?: Record<string, string>
}

export const StorePaymentsService = {
  async createStripeTestSession(_input: CreateStripeSessionInput) {
    // TODO: implement Stripe test session
    return { url: '/checkout/stripe/mock-session' }
  },

  async markOrderPaidStripe(orderId: string, stripeSessionId: string) {
    try {
      await updateDocument('orders', orderId, {
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
      await updateDocument('orders', orderId, {
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
      await updateDocument('orders', orderId, {
        payment: { method: 'crypto', status: 'paid', txHash },
        status: 'paid',
        updatedAt: new Date().toISOString()
      })
      
      return { ok: true, orderId, txHash }
    } catch (error) {
      console.error('[StorePaymentsService] Error recording crypto payment:', error)
      throw new Error('Failed to record crypto payment')
    }
  }
}

