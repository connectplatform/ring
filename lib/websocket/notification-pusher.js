/**
 * Server-side notification pusher
 * Sends real-time notifications to connected clients via WebSocket
 */

import { getAdminDb } from '../firebase/admin-db.js'

export class NotificationPusher {
  constructor(io) {
    this.io = io
    this.db = null
    this.initializeDatabase()
    this.setupNotificationWatcher()
  }

  async initializeDatabase() {
    try {
      this.db = await getAdminDb()
      console.log('✅ NotificationPusher: Database initialized')
    } catch (error) {
      console.error('❌ NotificationPusher: Failed to initialize database:', error)
    }
  }

  /**
   * Watch for new notifications in Firestore and push them via WebSocket
   */
  setupNotificationWatcher() {
    if (!this.db) {
      console.warn('Database not initialized, skipping notification watcher')
      return
    }

    try {
      // Listen for new notifications added to Firestore
      const notificationsRef = this.db.collection('notifications')
      
      // Watch for new notifications
      notificationsRef
        .where('status', '==', 'pending')
        .where('createdAt', '>=', new Date())
        .onSnapshot((snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const notification = {
                id: change.doc.id,
                ...change.doc.data(),
                timestamp: new Date()
              }
              
              this.pushNotification(notification)
            }
          })
        }, (error) => {
          console.error('Error watching notifications:', error)
        })

      console.log('✅ NotificationPusher: Watcher initialized')
    } catch (error) {
      console.error('❌ NotificationPusher: Failed to setup watcher:', error)
    }
  }

  /**
   * Push a notification to a specific user via WebSocket
   */
  async pushNotification(notification) {
    try {
      const { userId, type, title, body, priority = 'normal', data = {} } = notification

      if (!userId) {
        console.warn('No userId specified for notification')
        return
      }

      // Format notification for client
      const formattedNotification = {
        id: notification.id,
        type: type || 'system',
        title,
        body,
        timestamp: new Date(),
        priority,
        data
      }

      // Send to user's notification channel
      const userChannel = `user:${userId}:notifications`
      this.io.to(userChannel).emit('notification', formattedNotification)
      
      console.log(`📬 Pushed notification to user ${userId}: ${title}`)

      // Mark notification as delivered in database
      if (this.db && notification.id) {
        await this.db.collection('notifications').doc(notification.id).update({
          status: 'delivered',
          deliveredAt: new Date()
        })
      }
    } catch (error) {
      console.error('Error pushing notification:', error)
    }
  }

  /**
   * Push notification to multiple users
   */
  async pushBroadcastNotification(userIds, notification) {
    try {
      const formattedNotification = {
        id: `broadcast-${Date.now()}`,
        type: notification.type || 'broadcast',
        title: notification.title,
        body: notification.body,
        timestamp: new Date(),
        priority: notification.priority || 'normal',
        data: notification.data || {}
      }

      // Send to each user's channel
      userIds.forEach(userId => {
        const userChannel = `user:${userId}:notifications`
        this.io.to(userChannel).emit('notification', formattedNotification)
      })

      console.log(`📢 Broadcast notification sent to ${userIds.length} users: ${notification.title}`)
    } catch (error) {
      console.error('Error broadcasting notification:', error)
    }
  }

  /**
   * Send system-wide notification
   */
  async pushSystemNotification(notification) {
    try {
      const formattedNotification = {
        id: `system-${Date.now()}`,
        type: 'system',
        title: notification.title,
        body: notification.body,
        timestamp: new Date(),
        priority: notification.priority || 'high',
        data: notification.data || {}
      }

      // Broadcast to all connected clients
      this.io.emit('notification', formattedNotification)
      
      console.log(`🔔 System notification sent: ${notification.title}`)
    } catch (error) {
      console.error('Error pushing system notification:', error)
    }
  }

  /**
   * Update unread count for a user
   */
  async updateUnreadCount(userId) {
    try {
      if (!this.db) return

      // Get unread count from database
      const unreadSnapshot = await this.db
        .collection('notifications')
        .where('userId', '==', userId)
        .where('read', '==', false)
        .get()

      const unreadCount = unreadSnapshot.size

      // Send updated count to user
      const userChannel = `user:${userId}:notifications`
      this.io.to(userChannel).emit('notification:unread_count', unreadCount)
      
      console.log(`📊 Updated unread count for ${userId}: ${unreadCount}`)
    } catch (error) {
      console.error('Error updating unread count:', error)
    }
  }

  /**
   * Handle notification from API endpoint
   * This can be called when notifications are created via REST API
   */
  async handleApiNotification(notificationData) {
    try {
      // Save to database if needed
      if (this.db) {
        const docRef = await this.db.collection('notifications').add({
          ...notificationData,
          createdAt: new Date(),
          status: 'pending',
          read: false
        })
        
        notificationData.id = docRef.id
      }

      // Push via WebSocket
      await this.pushNotification(notificationData)
      
      // Update unread count
      if (notificationData.userId) {
        await this.updateUnreadCount(notificationData.userId)
      }

      return { success: true, id: notificationData.id }
    } catch (error) {
      console.error('Error handling API notification:', error)
      return { success: false, error: error.message }
    }
  }
}

export default NotificationPusher
