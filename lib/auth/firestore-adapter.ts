import { getAdminDb } from '@/lib/firebase-admin.server'
import { UserRole } from '@/features/auth/types'

export function firestoreAdapter() {
  return {
    id: 'firestore-adapter',
    
    async create(table: string, data: any) {
      const db = getAdminDb()
      const ref = db.collection(table).doc()
      
      const createData = {
        ...data,
        id: ref.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      
      // Handle Ring-specific user fields
      if (table === 'user') {
        createData.role = data.role || UserRole.SUBSCRIBER
        createData.wallets = JSON.stringify(data.wallets || [])
        createData.isSuperAdmin = data.isSuperAdmin || false
        createData.isVerified = data.isVerified || false
        createData.authProvider = data.authProvider || 'email'
        createData.authProviderId = data.authProviderId || ref.id
        createData.lastLogin = data.lastLogin || new Date()
        createData.settings = JSON.stringify(data.settings || {
          language: 'en',
          theme: 'system',
          notifications: true,
          notificationPreferences: { email: true, inApp: true, sms: false }
        })
        createData.notificationPreferences = JSON.stringify(data.notificationPreferences || { email: true, inApp: true, sms: false })
        createData.canPostconfidentialOpportunities = data.canPostconfidentialOpportunities || false
        createData.canViewconfidentialOpportunities = data.canViewconfidentialOpportunities || false
        createData.postedopportunities = JSON.stringify(data.postedopportunities || [])
        createData.savedopportunities = JSON.stringify(data.savedopportunities || [])
      }
      
      await ref.set(createData)
      return this.transformDoc(table, ref.id, createData)
    },

    async findOne(table: string, where: any) {
      const db = getAdminDb()
      let query: any = db.collection(table)
      
      Object.entries(where).forEach(([key, value]) => {
        query = query.where(key, '==', value)
      })
      
      const snapshot = await query.limit(1).get()
      if (snapshot.empty) return null
      
      const doc = snapshot.docs[0]
      return this.transformDoc(table, doc.id, doc.data())
    },

    async findMany(table: string, where: any = {}) {
      const db = getAdminDb()
      let query: any = db.collection(table)
      
      Object.entries(where).forEach(([key, value]) => {
        query = query.where(key, '==', value)
      })
      
      const snapshot = await query.get()
      return snapshot.docs.map((doc: any) => this.transformDoc(table, doc.id, doc.data()))
    },

    async update(table: string, where: any, data: any) {
      const db = getAdminDb()
      const existing = await this.findOne(table, where)
      
      if (!existing) return null
      
      const updateData = {
        ...data,
        updatedAt: new Date(),
      }
      
      await db.collection(table).doc(existing.id).update(updateData)
      return { ...existing, ...updateData }
    },

    async delete(table: string, where: any) {
      const db = getAdminDb()
      const existing = await this.findOne(table, where)
      
      if (!existing) return null
      
      await db.collection(table).doc(existing.id).delete()
      return existing
    },

    transformDoc(table: string, id: string, data: any) {
      const transformed = {
        id,
        ...data,
        createdAt: this.transformTimestamp(data.createdAt),
        updatedAt: this.transformTimestamp(data.updatedAt),
      }
      
      if (table === 'session' && data.expiresAt) {
        transformed.expiresAt = this.transformTimestamp(data.expiresAt)
      }
      
      if (table === 'user' && data.emailVerified) {
        transformed.emailVerified = this.transformTimestamp(data.emailVerified)
      }
      
      if (table === 'verification' && data.expires) {
        transformed.expires = this.transformTimestamp(data.expires)
      }
      
      return transformed
    },

    transformTimestamp(timestamp: any) {
      if (!timestamp) return null
      if (timestamp.seconds) {
        return new Date(timestamp.seconds * 1000)
      }
      return timestamp instanceof Date ? timestamp : new Date(timestamp)
    }
  }
}
