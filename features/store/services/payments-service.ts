// Payment orchestration service for Store domain
// Future: integrate real Stripe sessions and on-chain flows

import { getAdminDb } from '@/lib/firebase-admin.server'

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
    const db = await getAdminDb()
    await db.collection('orders').doc(orderId).set({
      payment: { method: 'stripe', status: 'paid', stripeSessionId },
      status: 'paid',
      updatedAt: new Date().toISOString()
    }, { merge: true })
    return { ok: true, orderId }
  },

  async markOrderFailedStripe(orderId: string, stripeSessionId: string) {
    const db = await getAdminDb()
    await db.collection('orders').doc(orderId).set({
      payment: { method: 'stripe', status: 'failed', stripeSessionId },
      updatedAt: new Date().toISOString()
    }, { merge: true })
    return { ok: true, orderId }
  },

  async recordCryptoPayment(orderId: string, txHash: string) {
    const db = await getAdminDb()
    await db.collection('orders').doc(orderId).set({
      payment: { method: 'crypto', status: 'paid', txHash },
      status: 'paid',
      updatedAt: new Date().toISOString()
    }, { merge: true })
    return { ok: true, orderId, txHash }
  }
}


