// 🚀 RING-NATIVE: DatabaseService for token storage + Firebase Admin for push delivery
// Token storage: DatabaseService (follows backend mode config)
// Push delivery: Firebase Admin SDK (FCM infrastructure)
// React 19: NO cache on token operations (real-time device registration)

import { getMessaging } from 'firebase-admin/messaging'
import { auth } from '@/auth'
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService'
import { revalidatePath } from 'next/cache'

export interface FCMToken {
  id?: string
  userId: string
  token: string
  deviceInfo: {
    platform: string
    browser: string
    userAgent: string
    lastSeen: Date
  }
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface FCMNotification {
  title: string
  body: string
  icon?: string
  badge?: string
  image?: string
  data?: Record<string, string>
  clickAction?: string
  tag?: string
}

export class FCMService {
  private messaging: any = null

  private getMessagingInstance() {
    if (!this.messaging) {
      try {
        this.messaging = getMessaging()
      } catch (error) {
        console.warn('Firebase messaging not available:', error.message)
        throw error
      }
    }
    return this.messaging
  }

  // Database service for token storage (Ring-native!)
  private async getDb() {
    await initializeDatabase()
    return getDatabaseService()
  }

  /**
   * Register a new FCM token for a user
   */
  async registerToken(
    userId: string, 
    token: string, 
    deviceInfo: FCMToken['deviceInfo']
  ): Promise<void> {
    try {
      const db = await this.getDb()
      
      // Check if token already exists
      const existingResult = await db.query({
        collection: 'fcm_tokens',
        filters: [{ field: 'token', operator: '==', value: token }],
        pagination: { limit: 1 }
      })

      const now = new Date()

      if (existingResult.success && existingResult.data.length > 0) {
        // Update existing token
        const tokenId = existingResult.data[0].id
        await db.update('fcm_tokens', tokenId, {
          userId,
          deviceInfo,
          isActive: true,
          updatedAt: now
        })
      } else {
        // Create new token (MUTATION - NO CACHE!)
        await db.create('fcm_tokens', {
          userId,
          token,
          deviceInfo: {
            ...deviceInfo,
            lastSeen: deviceInfo.lastSeen
          },
          isActive: true,
          createdAt: now,
          updatedAt: now
        })
      }

      console.log(`FCM token registered for user ${userId}`)
    } catch (error) {
      console.error('Error registering FCM token:', error)
      throw new Error('Failed to register FCM token')
    }
  }

  /**
   * Send notification to a specific user
   */
  async sendToUser(userId: string, notification: FCMNotification): Promise<void> {
    try {
      const db = await this.getDb()
      
      // Get all active tokens for the user (READ - can cache)
      const tokensResult = await db.query({
        collection: 'fcm_tokens',
        filters: [
          { field: 'userId', operator: '==', value: userId },
          { field: 'isActive', operator: '==', value: true }
        ]
      })

      if (!tokensResult.success || tokensResult.data.length === 0) {
        console.log(`No active FCM tokens found for user ${userId}`)
        return
      }

      const tokens = tokensResult.data.map((doc: any) => doc.token)
      await this.sendToTokens(tokens, notification)

    } catch (error) {
      console.error(`Error sending notification to user ${userId}:`, error)
      throw new Error('Failed to send notification to user')
    }
  }

  /**
   * Send notification to multiple tokens
   */
  async sendToTokens(tokens: string[], notification: FCMNotification): Promise<void> {
    try {
      const message = {
        notification: {
          title: notification.title,
          body: notification.body,
          ...(notification.icon && { icon: notification.icon }),
          ...(notification.image && { image: notification.image })
        },
        data: notification.data || {},
        webpush: {
          notification: {
            title: notification.title,
            body: notification.body,
            icon: notification.icon || '/icons/notification-icon.png',
            badge: notification.badge || '/icons/badge-icon.png',
            ...(notification.image && { image: notification.image }),
            ...(notification.clickAction && { click_action: notification.clickAction }),
            ...(notification.tag && { tag: notification.tag }),
            requireInteraction: true,
            silent: false
          },
          fcm_options: {
            link: notification.clickAction || '/'
          }
        },
        tokens
      }

      const response = await this.getMessagingInstance().sendEachForMulticast(message)
      
      // Handle failed tokens
      if (response.failureCount > 0) {
        await this.handleFailedTokens(tokens, response.responses)
      }

      console.log(`FCM notification sent to ${response.successCount}/${tokens.length} tokens`)
    } catch (error) {
      console.error('Error sending FCM notification:', error)
      throw new Error('Failed to send FCM notification')
    }
  }

  /**
   * Send notification to multiple users
   */
  async sendToUsers(userIds: string[], notification: FCMNotification): Promise<void> {
    try {
      const db = await this.getDb()
      
      // Get all active tokens for the users (batched query for multiple users)
      const tokensResult = await db.query({
        collection: 'fcm_tokens',
        filters: [
          { field: 'userId', operator: 'in', value: userIds },
          { field: 'isActive', operator: '==', value: true }
        ]
      })

      if (!tokensResult.success || tokensResult.data.length === 0) {
        console.log('No active FCM tokens found for specified users')
        return
      }

      const tokens = tokensResult.data.map((doc: any) => doc.token)
      await this.sendToTokens(tokens, notification)

    } catch (error) {
      console.error('Error sending notification to users:', error)
      throw new Error('Failed to send notification to users')
    }
  }

  /**
   * Send notification to all users (broadcast)
   */
  async sendToAllUsers(notification: FCMNotification): Promise<void> {
    try {
      const db = await this.getDb()
      
      const tokensResult = await db.query({
        collection: 'fcm_tokens',
        filters: [{ field: 'isActive', operator: '==', value: true }]
      })

      if (!tokensResult.success || tokensResult.data.length === 0) {
        console.log('No active FCM tokens found')
        return
      }

      const tokens = tokensResult.data.map((doc: any) => doc.token)
      
      // Send in batches of 500 (FCM limit)
      const batchSize = 500
      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize)
        await this.sendToTokens(batch, notification)
      }

    } catch (error) {
      console.error('Error sending broadcast notification:', error)
      throw new Error('Failed to send broadcast notification')
    }
  }

  /**
   * Remove a token (when user logs out or unsubscribes)
   */
  async removeToken(token: string): Promise<void> {
    try {
      const db = await this.getDb()
      
      const tokenResult = await db.query({
        collection: 'fcm_tokens',
        filters: [{ field: 'token', operator: '==', value: token }],
        pagination: { limit: 1 }
      })

      if (tokenResult.success && tokenResult.data.length > 0) {
        const tokenId = tokenResult.data[0].id
        await db.update('fcm_tokens', tokenId, {
          isActive: false,
          updatedAt: new Date()
        })
      }

      console.log('FCM token removed')
    } catch (error) {
      console.error('Error removing FCM token:', error)
      throw new Error('Failed to remove FCM token')
    }
  }

  /**
   * Clean up inactive tokens
   */
  async cleanupInactiveTokens(daysInactive: number = 30): Promise<void> {
    try {
      const db = await this.getDb()
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysInactive)

      const inactiveResult = await db.query({
        collection: 'fcm_tokens',
        filters: [{ field: 'deviceInfo.lastSeen', operator: '<', value: cutoffDate }]
      })

      if (!inactiveResult.success || inactiveResult.data.length === 0) {
        console.log('No inactive tokens to cleanup')
        return
      }

      // Update each inactive token (batch operation)
      let cleanedCount = 0
      for (const doc of inactiveResult.data) {
        const updateResult = await db.update('fcm_tokens', doc.id, { isActive: false })
        if (updateResult.success) cleanedCount++
      }

      console.log(`Cleaned up ${cleanedCount} inactive FCM tokens`)

    } catch (error) {
      console.error('Error cleaning up inactive tokens:', error)
      throw new Error('Failed to cleanup inactive tokens')
    }
  }

  /**
   * Handle failed token responses
   */
  private async handleFailedTokens(
    tokens: string[], 
    responses: any[]
  ): Promise<void> {
    const failedTokens: string[] = []

    responses.forEach((response, index) => {
      if (!response.success) {
        const error = response.error
        
        // Token is invalid or unregistered
        if (error?.code === 'messaging/invalid-registration-token' ||
            error?.code === 'messaging/registration-token-not-registered') {
          failedTokens.push(tokens[index])
        }
      }
    })

    // Remove failed tokens (batch update)
    if (failedTokens.length > 0) {
      const db = await this.getDb()
      
      for (const token of failedTokens) {
        const tokenResult = await db.query({
          collection: 'fcm_tokens',
          filters: [{ field: 'token', operator: '==', value: token }],
          pagination: { limit: 1 }
        })
        
        if (tokenResult.success && tokenResult.data.length > 0) {
          await db.update('fcm_tokens', tokenResult.data[0].id, { isActive: false })
        }
      }

      console.log(`Removed ${failedTokens.length} invalid FCM tokens`)
    }
  }

  /**
   * Get user's active tokens count
   */
  async getUserTokensCount(userId: string): Promise<number> {
    try {
      const db = await this.getDb()
      
      const tokensResult = await db.query({
        collection: 'fcm_tokens',
        filters: [
          { field: 'userId', operator: '==', value: userId },
          { field: 'isActive', operator: '==', value: true }
        ]
      })

      return tokensResult.success ? tokensResult.data.length : 0
    } catch (error) {
      console.error('Error getting user tokens count:', error)
      return 0
    }
  }

  /**
   * Update token's last seen timestamp
   */
  async updateTokenLastSeen(token: string): Promise<void> {
    try {
      const db = await this.getDb()
      
      const tokenResult = await db.query({
        collection: 'fcm_tokens',
        filters: [{ field: 'token', operator: '==', value: token }],
        pagination: { limit: 1 }
      })

      if (tokenResult.success && tokenResult.data.length > 0) {
        const tokenId = tokenResult.data[0].id
        await db.update('fcm_tokens', tokenId, {
          'deviceInfo.lastSeen': new Date(),
          updatedAt: new Date()
        })
      }
    } catch (error) {
      console.error('Error updating token last seen:', error)
    }
  }
}

// Export singleton instance
export const fcmService = new FCMService() 