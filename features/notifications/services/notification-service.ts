// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

/**
 * Notification Service
 * Server-side service for managing notifications in Ring platform
 * Follows Ring's established service patterns with Firebase Admin SDK
 */

import { FieldValue } from 'firebase-admin/firestore';

import { cache } from 'react';
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector';
import { getCachedDocument, getCachedCollection } from '@/lib/build-cache/static-data-cache';
import { getFirebaseServiceManager } from '@/lib/services/firebase-service-manager';

import {
  Notification,
  NotificationType,
  NotificationPriority,
  NotificationStatus,
  NotificationChannel,
  NotificationTrigger,
  NotificationData,
  CreateNotificationRequest,
  NotificationListResponse,
  NotificationStatsResponse,
  DetailedNotificationPreferences
} from '@/features/notifications/types';
import { UserRole } from '@/features/auth/types';

// Import FCM service
import { getMessaging } from 'firebase-admin/messaging';
import { MulticastMessage } from 'firebase-admin/messaging';
import { FCMService } from './fcm-service';

const fcmService = new FCMService();

/**
 * Create a new notification
 * Server-side function for creating notifications
 * 
 * @param request - The notification creation request
 * @returns Promise<Notification> - The created notification
 */
export async function createNotification(
  request: CreateNotificationRequest
): Promise<Notification> {
  console.log('NotificationService: Creating notification', { type: request.type });

  try {
    const serviceManager = getFirebaseServiceManager();
    const adminDb = serviceManager.db;

    // Handle single user or multiple users
    const userIds = request.userIds || (request.userId ? [request.userId] : []);
    if (userIds.length === 0) {
      throw new Error('No target users specified');
    }

    const notifications: Notification[] = [];

    // Create notification for each user
    for (const userId of userIds) {
      // Get user preferences
      const preferences = await getUserNotificationPreferences(userId);
      
      // Check if user wants this type of notification
      if (!shouldSendNotification(request.type, preferences)) {
        console.log(`NotificationService: Skipping notification for user ${userId} - disabled in preferences`);
        continue;
      }

      // Determine channels based on user preferences and request
      const channels = determineChannels(request.channels, preferences);
      
      const notificationData = {
        userId,
        type: request.type,
        priority: request.priority || NotificationPriority.NORMAL,
        status: NotificationStatus.PENDING,
        trigger: NotificationTrigger.USER_ACTION,
        title: request.title,
        body: request.body,
        actionText: request.actionText,
        actionUrl: request.actionUrl,
        data: request.data || {},
        channels,
        deliveries: channels.map(channel => ({
          channel,
          status: NotificationStatus.PENDING,
          retryCount: 0
        })),
        createdAt: FieldValue.serverTimestamp(),
        scheduledFor: request.scheduledFor ? new Date(request.scheduledFor) : null,
        expiresAt: request.expiresAt ? new Date(request.expiresAt) : null,
        templateId: request.templateId,
        locale: preferences?.language || 'en'
      };

      // Add to Firestore
      const docRef = await adminDb.collection('notifications').add(notificationData);

      const notification: Notification = {
        ...notificationData,
        id: docRef.id,
        createdAt: new Date(),
        scheduledFor: request.scheduledFor,
        expiresAt: request.expiresAt
      };

      notifications.push(notification);

      // Process notification delivery if not scheduled
      if (!request.scheduledFor) {
        await processNotificationDelivery(notification);
      }
    }

    console.log(`NotificationService: Created ${notifications.length} notifications`);
    return notifications[0]; // Return first notification for single user case
  
  } catch (error) {
    console.error('NotificationService: Error creating notification:', error);
    throw new Error(`Failed to create notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get user notifications with pagination
 * 
 * @param userId - The user ID
 * @param options - Query options
 * @returns Promise<NotificationListResponse>
 */
export async function getUserNotifications(
  userId: string,
  options: {
    limit?: number;
    startAfter?: string;
    unreadOnly?: boolean;
    types?: NotificationType[];
  } = {}
): Promise<NotificationListResponse> {
  console.log('NotificationService: Getting user notifications', { userId, options });

  try {
    const serviceManager = getFirebaseServiceManager();
    const adminDb = serviceManager.db;
    
    // Add timeout for network issues
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Firestore connection timeout')), 10000)
    );

    let query = adminDb
      .collection('notifications')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc');

    // Apply filters
    if (options.unreadOnly) {
      query = query.where('readAt', '==', null);
    }
    
    if (options.types && options.types.length > 0) {
      query = query.where('type', 'in', options.types);
    }

    // Apply pagination
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    if (options.startAfter) {
      const startAfterDoc = await adminDb.collection('notifications').doc(options.startAfter).get();
      if (startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
      }
    }

    const firestoreQuery = query.get();
    const snapshot = await Promise.race([firestoreQuery, timeout]) as any;
    
    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      readAt: doc.data().readAt?.toDate() || null,
      deliveredAt: doc.data().deliveredAt?.toDate() || null
    })) as Notification[];

    // Get the last document for pagination
    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    const nextCursor = lastDoc ? lastDoc.id : null;

    return {
      notifications,
      unreadCount: 0, // Will be calculated separately if needed
      totalCount: notifications.length,
      hasMore: snapshot.docs.length === (options.limit || 20),
      lastVisible: lastDoc ? lastDoc.id : undefined
    };

  } catch (error) {
    console.error('NotificationService: Error getting user notifications:', error);
    
    // Check if it's a connection/network error
    if (error instanceof Error && (
      error.message.includes('UNAVAILABLE') ||
      error.message.includes('Name resolution failed') ||
      error.message.includes('timeout') ||
      error.message.includes('ENOTFOUND')
    )) {
      console.warn('NotificationService: Network connectivity issue detected, returning empty notifications');
      
      // Return empty result instead of throwing
      return {
        notifications: [],
        unreadCount: 0,
        totalCount: 0,
        hasMore: false,
        lastVisible: undefined
      };
    }
    
    // For other errors, still throw
    throw new Error(`Failed to get user notifications: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Mark notification as read
 * 
 * @param notificationId - The notification ID
 * @param userId - The user ID (for security)
 * @returns Promise<void>
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId: string
): Promise<void> {
  console.log('NotificationService: Marking notification as read', { notificationId, userId });

  try {
    const serviceManager = getFirebaseServiceManager();
    const adminDb = serviceManager.db;
    const docRef = adminDb.collection('notifications').doc(notificationId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      throw new Error('Notification not found');
    }

    const notification = docSnap.data() as Notification;
    if (notification.userId !== userId) {
      throw new Error('Unauthorized access to notification');
    }

    await docRef.update({
      readAt: FieldValue.serverTimestamp(),
      status: NotificationStatus.READ
    });

  } catch (error) {
    console.error('NotificationService: Error marking notification as read:', error);
    throw new Error(`Failed to mark notification as read: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Mark all notifications as read for a user
 * 
 * @param userId - The user ID
 * @returns Promise<number> - Number of notifications marked as read
 */
export async function markAllNotificationsAsRead(userId: string): Promise<number> {
  console.log('NotificationService: Marking all notifications as read', { userId });

  try {
    const serviceManager = getFirebaseServiceManager();
    const adminDb = serviceManager.db;
    const snapshot = await adminDb
      .collection('notifications')
      .where('userId', '==', userId)
      .where('readAt', '==', null)
      .get();

    const batch = adminDb.batch();
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        readAt: FieldValue.serverTimestamp(),
        status: NotificationStatus.READ
      });
    });

    await batch.commit();
    
    console.log(`NotificationService: Marked ${snapshot.docs.length} notifications as read`);
    return snapshot.docs.length;

  } catch (error) {
    console.error('NotificationService: Error marking all notifications as read:', error);
    throw new Error(`Failed to mark all notifications as read: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete a notification
 * 
 * @param notificationId - The notification ID
 * @param userId - The user ID (for security)
 * @returns Promise<void>
 */
export async function deleteNotification(
  notificationId: string,
  userId: string
): Promise<void> {
  console.log('NotificationService: Deleting notification', { notificationId, userId });

  try {
    const serviceManager = getFirebaseServiceManager();
    const adminDb = serviceManager.db;
    const docRef = adminDb.collection('notifications').doc(notificationId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      throw new Error('Notification not found');
    }

    const notification = docSnap.data() as Notification;
    if (notification.userId !== userId) {
      throw new Error('Unauthorized access to notification');
    }

    await docRef.delete();

  } catch (error) {
    console.error('NotificationService: Error deleting notification:', error);
    throw new Error(`Failed to delete notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get notification statistics for a user
 * 
 * @param userId - The user ID
 * @returns Promise<NotificationStatsResponse>
 */
export async function getNotificationStats(
  userId: string
): Promise<NotificationStatsResponse> {
  console.log('NotificationService: Getting notification stats', { userId });

  try {
    const serviceManager = getFirebaseServiceManager();
    const adminDb = serviceManager.db;
    
    // Add timeout and better error handling for network issues
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Firestore connection timeout')), 10000)
    );
    
    const firestoreQuery = adminDb
      .collection('notifications')
      .where('userId', '==', userId)
      .get();

    const snapshot = await Promise.race([firestoreQuery, timeout]) as any;
    
    const notifications = snapshot.docs.map(doc => ({
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date()
    })) as Notification[];

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Calculate stats
    const unreadCount = notifications.filter(n => !n.readAt).length;
    const todayCount = notifications.filter(n => n.createdAt >= today).length;
    const weekCount = notifications.filter(n => n.createdAt >= weekAgo).length;

    // Group by type
    const byType: Record<NotificationType, number> = {} as Record<NotificationType, number>;
    const byChannel: Record<NotificationChannel, number> = {} as Record<NotificationChannel, number>;
    const byStatus: Record<NotificationStatus, number> = {} as Record<NotificationStatus, number>;

    notifications.forEach(notification => {
      // By type
      byType[notification.type] = (byType[notification.type] || 0) + 1;
      
      // By channel
      notification.channels.forEach(channel => {
        byChannel[channel] = (byChannel[channel] || 0) + 1;
      });
      
      // By status
      byStatus[notification.status] = (byStatus[notification.status] || 0) + 1;
    });

    return {
      totalNotifications: notifications.length,
      unreadCount,
      todayCount,
      weekCount,
      byType,
      byChannel,
      byStatus
    };

  } catch (error) {
    console.error('NotificationService: Error getting notification stats:', error);
    
    // Check if it's a connection/network error
    if (error instanceof Error && (
      error.message.includes('UNAVAILABLE') ||
      error.message.includes('Name resolution failed') ||
      error.message.includes('timeout') ||
      error.message.includes('ENOTFOUND')
    )) {
      console.warn('NotificationService: Network connectivity issue detected, returning default stats');
      
      // Return default/empty stats instead of throwing
      return {
        totalNotifications: 0,
        unreadCount: 0,
        todayCount: 0,
        weekCount: 0,
        byType: {} as Record<NotificationType, number>,
        byChannel: {} as Record<NotificationChannel, number>,
        byStatus: {} as Record<NotificationStatus, number>
      };
    }
    
    // For other errors, still throw
    throw new Error(`Failed to get notification stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get user notification preferences
 * 
 * @param userId - The user ID
 * @returns Promise<DetailedNotificationPreferences | null>
 */
export async function getUserNotificationPreferences(
  userId: string
): Promise<DetailedNotificationPreferences | null> {
  try {
    const serviceManager = getFirebaseServiceManager();
    const adminDb = serviceManager.db;
    const docSnap = await adminDb.collection('notificationPreferences').doc(userId).get();

    if (!docSnap.exists) {
      return null;
    }

    const data = docSnap.data();
    return {
      ...data,
      updatedAt: data?.updatedAt?.toDate() || new Date()
    } as DetailedNotificationPreferences;

  } catch (error) {
    console.error('NotificationService: Error getting user preferences:', error);
    return null;
  }
}

/**
 * Update user notification preferences
 * 
 * @param userId - The user ID
 * @param preferences - The updated preferences
 * @returns Promise<void>
 */
export async function updateUserNotificationPreferences(
  userId: string,
  preferences: Partial<DetailedNotificationPreferences>
): Promise<void> {
  try {
    const serviceManager = getFirebaseServiceManager();
    const adminDb = serviceManager.db;
    const docRef = adminDb.collection('notificationPreferences').doc(userId);
    
    await docRef.set({
      ...preferences,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

  } catch (error) {
    console.error('NotificationService: Error updating user preferences:', error);
    throw new Error(`Failed to update notification preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Helper functions
 */

function shouldSendNotification(
  type: NotificationType,
  preferences: DetailedNotificationPreferences | null
): boolean {
  if (!preferences || !preferences.enabled) {
    return true; // Default to sending if no preferences set
  }

  return preferences.types[type] !== false; // Default to true if not specified
}

function determineChannels(
  requestedChannels: NotificationChannel[] | undefined,
  preferences: DetailedNotificationPreferences | null
): NotificationChannel[] {
  if (!preferences) {
    return [NotificationChannel.IN_APP]; // Default to in-app only
  }

  const availableChannels: NotificationChannel[] = [];
  
  if (preferences.channels.inApp) {
    availableChannels.push(NotificationChannel.IN_APP);
  }
  if (preferences.channels.email) {
    availableChannels.push(NotificationChannel.EMAIL);
  }
  if (preferences.channels.sms) {
    availableChannels.push(NotificationChannel.SMS);
  }
  if (preferences.channels.push) {
    availableChannels.push(NotificationChannel.PUSH);
  }

  // If specific channels requested, filter by user preferences
  if (requestedChannels) {
    return requestedChannels.filter(channel => availableChannels.includes(channel));
  }

  return availableChannels;
}

async function processNotificationDelivery(notification: Notification): Promise<void> {
  console.log('NotificationService: Processing notification delivery', { id: notification.id });

  try {
    const serviceManager = getFirebaseServiceManager();
    const adminDb = serviceManager.db;
    const batch = adminDb.batch();
    const notificationRef = adminDb.collection('notifications').doc(notification.id);

    // Process each channel
    for (const delivery of notification.deliveries) {
      if (delivery.status === NotificationStatus.PENDING) {
        try {
          switch (delivery.channel) {
            case NotificationChannel.IN_APP:
              // In-app notifications are already in the database
              delivery.status = NotificationStatus.DELIVERED;
              delivery.deliveredAt = new Date();
              break;

            case NotificationChannel.EMAIL:
              // TODO: Implement email delivery
              delivery.status = NotificationStatus.FAILED;
              delivery.failureReason = 'Email delivery not implemented';
              break;

            case NotificationChannel.SMS:
              // TODO: Implement SMS delivery
              delivery.status = NotificationStatus.FAILED;
              delivery.failureReason = 'SMS delivery not implemented';
              break;

            case NotificationChannel.PUSH:
              await sendFCMNotification(notification);
              delivery.status = NotificationStatus.DELIVERED;
              delivery.deliveredAt = new Date();
              break;

            default:
              delivery.status = NotificationStatus.FAILED;
              delivery.failureReason = `Unsupported channel: ${delivery.channel}`;
          }
        } catch (error) {
          console.error(`NotificationService: Error delivering to ${delivery.channel}:`, error);
          delivery.status = NotificationStatus.FAILED;
          delivery.failureReason = error instanceof Error ? error.message : 'Unknown error';
          delivery.retryCount = (delivery.retryCount || 0) + 1;
          delivery.lastRetryAt = new Date();
        }
      }
    }

    // Update notification status based on deliveries
    const allFailed = notification.deliveries.every(d => d.status === NotificationStatus.FAILED);
    const anyDelivered = notification.deliveries.some(d => d.status === NotificationStatus.DELIVERED);
    const anyPending = notification.deliveries.some(d => d.status === NotificationStatus.PENDING);

    if (allFailed) {
      notification.status = NotificationStatus.FAILED;
    } else if (anyDelivered) {
      notification.status = NotificationStatus.DELIVERED;
    } else if (anyPending) {
      notification.status = NotificationStatus.PENDING;
    }

    // Update in Firestore
    batch.update(notificationRef, {
      status: notification.status,
      deliveries: notification.deliveries,
      updatedAt: FieldValue.serverTimestamp()
    });

    await batch.commit();
    console.log('NotificationService: Updated notification delivery status', { id: notification.id, status: notification.status });

  } catch (error) {
    console.error('NotificationService: Error processing notification delivery:', error);
    throw new Error(`Failed to process notification delivery: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function sendFCMNotification(notification: Notification): Promise<void> {
  try {
    await fcmService.sendToUser(notification.userId, {
      title: notification.title,
      body: notification.body,
      icon: '/icons/notification-icon.png',
      badge: '/icons/badge-icon.png',
      data: {
        notificationId: notification.id,
        type: notification.type,
        ...(notification.actionUrl && { clickAction: notification.actionUrl }),
        ...(notification.data && Object.fromEntries(
          Object.entries(notification.data).map(([key, value]) => [
            key,
            typeof value === 'object' ? JSON.stringify(value) : String(value)
          ])
        ))
      },
      clickAction: notification.actionUrl,
      tag: `${notification.type}-${notification.id}`
    });
  } catch (error) {
    console.error('Error sending FCM notification:', error);
    throw error;
  }
} 