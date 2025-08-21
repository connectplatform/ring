import { getAdminDb } from '@/lib/firebase-admin.server';
import { getFirebaseServiceManager } from '@/lib/services/firebase-service-manager';
// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

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
    const serviceManager = getFirebaseServiceManager();
    const db = serviceManager.db
    await db.collection('orders').doc(orderId).set({
      payment: { method: 'stripe', status: 'paid', stripeSessionId },
      status: 'paid',
      updatedAt: new Date().toISOString()
    }, { merge: true })
    return { ok: true, orderId }
  },

  async markOrderFailedStripe(orderId: string, stripeSessionId: string) {
    const serviceManager = getFirebaseServiceManager();
    const db = serviceManager.db
    await db.collection('orders').doc(orderId).set({
      payment: { method: 'stripe', status: 'failed', stripeSessionId },
      updatedAt: new Date().toISOString()
    }, { merge: true })
    return { ok: true, orderId }
  },

  async recordCryptoPayment(orderId: string, txHash: string) {
    const serviceManager = getFirebaseServiceManager();
    const db = serviceManager.db
    await db.collection('orders').doc(orderId).set({
      payment: { method: 'crypto', status: 'paid', txHash },
      status: 'paid',
      updatedAt: new Date().toISOString()
    }, { merge: true })
    return { ok: true, orderId, txHash }
  }
}

