// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { z } from 'zod'
import { orderCreateSchema } from '@/lib/zod'

import { cache } from 'react';
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector';
import { getCachedDocument, getCachedCollection, getCachedStoreProducts } from '@/lib/build-cache/static-data-cache';
import { getFirebaseServiceManager } from '@/lib/services/firebase-service-manager';

export const StoreOrdersService = {
  async listOrdersForUser(userId: string, opts?: { limit?: number; startAfter?: string }) {
    const serviceManager = getFirebaseServiceManager();
    const db = serviceManager.db
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100)
    let query = db.collection('orders').where('userId', '==', userId).orderBy('createdAt', 'desc').limit(limit)
    if (opts?.startAfter) {
      const startDoc = await db.collection('orders').doc(opts.startAfter).get()
      if (startDoc.exists) query = query.startAfter(startDoc)
    }
    const snap = await query.get()
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    const lastVisible = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1].id : null
    return { items, lastVisible }
  },

  async getOrderById(id: string) {
    const serviceManager = getFirebaseServiceManager();
    const db = serviceManager.db
    const doc = await db.collection('orders').doc(id).get()
    if (!doc.exists) return null
    return { id: doc.id, ...doc.data() }
  },

  async createOrder(userId: string, data: z.infer<typeof orderCreateSchema>) {
    const serviceManager = getFirebaseServiceManager();
    const db = serviceManager.db
    const now = new Date().toISOString()
    const doc = await db.collection('orders').add({ ...data, userId, status: data.status || 'new', createdAt: now })
    return { orderId: doc.id }
  },

  async adminListAllOrders(opts?: { 
    limit?: number; 
    startAfter?: string; 
    statusFilter?: 'new' | 'paid' | 'processing' | 'shipped' | 'completed' | 'canceled';
  }) {
    const serviceManager = getFirebaseServiceManager();
    const db = serviceManager.db
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100)
    let query = db.collection('orders').orderBy('createdAt', 'desc').limit(limit)
    
    // Apply status filter if provided
    if (opts?.statusFilter) {
      query = query.where('status', '==', opts.statusFilter)
    }
    
    // Apply pagination if provided
    if (opts?.startAfter) {
      const startDoc = await db.collection('orders').doc(opts.startAfter).get()
      if (startDoc.exists) query = query.startAfter(startDoc)
    }
    
    const snap = await query.get()
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    const lastVisible = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1].id : null
    return { items, lastVisible }
  },

  async adminUpdateOrderStatus(id: string, status: 'new' | 'paid' | 'processing' | 'shipped' | 'completed' | 'canceled') {
    const serviceManager = getFirebaseServiceManager();
    const db = serviceManager.db
    await db.collection('orders').doc(id).update({ status, updatedAt: new Date().toISOString() })
    return true
  }
}

