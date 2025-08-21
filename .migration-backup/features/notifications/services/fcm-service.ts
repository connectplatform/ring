import { getMessaging } from 'firebase-admin/messaging'
import { auth } from '@/auth'
import { getAdminDb } from '@/lib/firebase-admin.server'
import { Timestamp, FieldValue } from 'firebase-admin/firestore'

const db = getAdminDb()

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
  private messaging = getMessaging()
  private tokensCollection = db.collection('fcm_tokens')

  /**
   * Register a new FCM token for a user
   */
  async registerToken(
    userId: string, 
    token: string, 
    deviceInfo: FCMToken['deviceInfo']
  ): Promise<void> {
    try {
      // Check if token already exists
      const existingToken = await this.tokensCollection
        .where('token', '==', token)
        .limit(1)
        .get()

      if (!existingToken.empty) {
        // Update existing token
        const doc = existingToken.docs[0]
        await doc.ref.update({
          userId,
          deviceInfo,
          isActive: true,
          updatedAt: Timestamp.now()
        })
      } else {
        // Create new token
        await this.tokensCollection.add({
          userId,
          token,
          deviceInfo: {
            ...deviceInfo,
            lastSeen: Timestamp.fromDate(deviceInfo.lastSeen)
          },
          isActive: true,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
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
      // Get all active tokens for the user
      const tokensSnapshot = await this.tokensCollection
        .where('userId', '==', userId)
        .where('isActive', '==', true)
        .get()

      if (tokensSnapshot.empty) {
        console.log(`No active FCM tokens found for user ${userId}`)
        return
      }

      const tokens = tokensSnapshot.docs.map(doc => doc.data().token)
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

      const response = await this.messaging.sendEachForMulticast(message)
      
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
      // Get all active tokens for the users
      const tokensSnapshot = await this.tokensCollection
        .where('userId', 'in', userIds)
        .where('isActive', '==', true)
        .get()

      if (tokensSnapshot.empty) {
        console.log('No active FCM tokens found for specified users')
        return
      }

      const tokens = tokensSnapshot.docs.map(doc => doc.data().token)
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
      const tokensSnapshot = await this.tokensCollection
        .where('isActive', '==', true)
        .get()

      if (tokensSnapshot.empty) {
        console.log('No active FCM tokens found')
        return
      }

      const tokens = tokensSnapshot.docs.map(doc => doc.data().token)
      
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
      const tokenSnapshot = await this.tokensCollection
        .where('token', '==', token)
        .limit(1)
        .get()

      if (!tokenSnapshot.empty) {
        await tokenSnapshot.docs[0].ref.update({
          isActive: false,
          updatedAt: Timestamp.now()
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
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysInactive)

      const inactiveTokens = await this.tokensCollection
        .where('deviceInfo.lastSeen', '<', Timestamp.fromDate(cutoffDate))
        .get()

      const batch = db.batch()
      inactiveTokens.docs.forEach(doc => {
        batch.update(doc.ref, { isActive: false })
      })

      await batch.commit()
      console.log(`Cleaned up ${inactiveTokens.size} inactive FCM tokens`)

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

    // Remove failed tokens
    if (failedTokens.length > 0) {
      const batch = db.batch()
      
      for (const token of failedTokens) {
        const tokenDoc = await this.tokensCollection
          .where('token', '==', token)
          .limit(1)
          .get()
        
        if (!tokenDoc.empty) {
          batch.update(tokenDoc.docs[0].ref, { isActive: false })
        }
      }

      await batch.commit()
      console.log(`Removed ${failedTokens.length} invalid FCM tokens`)
    }
  }

  /**
   * Get user's active tokens count
   */
  async getUserTokensCount(userId: string): Promise<number> {
    try {
      const tokensSnapshot = await this.tokensCollection
        .where('userId', '==', userId)
        .where('isActive', '==', true)
        .get()

      return tokensSnapshot.size
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
      const tokenDoc = await this.tokensCollection
        .where('token', '==', token)
        .limit(1)
        .get()

      if (!tokenDoc.empty) {
        await tokenDoc.docs[0].ref.update({
          'deviceInfo.lastSeen': Timestamp.now(),
          updatedAt: Timestamp.now()
        })
      }
    } catch (error) {
      console.error('Error updating token last seen:', error)
    }
  }
}

// Export singleton instance
export const fcmService = new FCMService() 