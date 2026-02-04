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

import { cache } from 'react';
import {
  getDatabaseService,
  initializeDatabase
} from '@/lib/database';

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
 * PHASE 1: Publish unread count updates via tunnel for real-time UI updates
 */
async function publishUnreadCountUpdates(notifications: Notification[]): Promise<void> {
  try {
    // Get unique user IDs from notifications
    const userIds = [...new Set(notifications.map(n => n.userId))];

    // For each user, calculate unread count and publish via tunnel
    for (const userId of userIds) {
      try {
        // Get current unread count for this user
        const dbService = getDatabaseService();
        const unreadCount = await dbService.count(
          'notifications',
          [
            { field: 'user_id', operator: '==', value: userId },
            { field: 'read_at', operator: '==', value: null }
          ]
        );

        // Publish update via tunnel
        const { publishToTunnel } = await import('@/lib/tunnel/publisher');
        await publishToTunnel(userId, 'notifications:unread', {
          unreadCount,
          timestamp: Date.now()
        });

        console.log(`NotificationService: Published unread count ${unreadCount} for user ${userId}`);
      } catch (userError) {
        console.warn(`NotificationService: Failed to publish for user ${userId}:`, userError);
      }
    }
  } catch (error) {
    console.error('NotificationService: Error publishing tunnel updates:', error);
    // Don't throw - tunnel publishing failure shouldn't break notifications
  }
}

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
    // Initialize database service
    const initResult = await initializeDatabase();
    if (!initResult.success) {
      throw new Error('Database initialization failed');
    }

    const dbService = getDatabaseService();

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
        user_id: userId,
        type: request.type,
        priority: request.priority || NotificationPriority.NORMAL,
        status: NotificationStatus.PENDING,
        trigger_type: NotificationTrigger.USER_ACTION,
        title: request.title,
        body: request.body,
        action_text: request.actionText,
        action_url: request.actionUrl,
        data: request.data || {},
        channels,
        deliveries: channels.map(channel => ({
          channel,
          status: NotificationStatus.PENDING,
          retryCount: 0
        })),
        scheduled_for: request.scheduledFor ? new Date(request.scheduledFor) : null,
        expires_at: request.expiresAt ? new Date(request.expiresAt) : null,
        template_id: request.templateId,
        locale: preferences?.language || 'en'
      };

      // Create notification in PostgreSQL
      const createResult = await dbService.create('notifications', notificationData);
      if (!createResult.success) {
        console.error('NotificationService: Failed to create notification:', createResult.error);
        throw new Error('Failed to create notification in database');
      }

      const notification: Notification = {
        ...notificationData,
        id: createResult.data.id,
        userId,
        trigger: NotificationTrigger.USER_ACTION,
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

    // PHASE 1: Publish unread count updates via tunnel for real-time updates
    try {
      await publishUnreadCountUpdates(notifications);
    } catch (tunnelError) {
      console.warn('NotificationService: Failed to publish tunnel updates:', tunnelError);
      // Don't fail the notification creation if tunnel publishing fails
    }

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
    // Ensure database is initialized once per request
    await initializeDatabase();

    // Build database query
    const filters: Array<{ field: string; operator: string; value: any }> = [{ field: 'userId', operator: '==', value: userId }];
    const orderBy = [{ field: 'created_at', direction: 'desc' as const }];
    const pagination: any = {};

    // Apply filters
    if (options.unreadOnly) {
      filters.push({ field: 'readAt', operator: '==' as const, value: null });
    }

    if (options.types && options.types.length > 0) {
      filters.push({ field: 'type', operator: 'in', value: options.types });
    }

    // Apply pagination
    if (options.limit) {
      pagination.limit = options.limit;
    }

    // Execute database query
    const dbService = getDatabaseService();
    const queryResult = await dbService.query({
      collection: 'notifications',
      filters,
      orderBy,
      pagination
    });

    if (!queryResult.success) {
      throw new Error('Failed to query notifications');
    }

    const notifications = queryResult.data.map(doc => {
      const data = doc.data;
      return {
        ...data,
        id: doc.id,
        createdAt: data?.created_at || new Date(),
        readAt: data?.read_at || null,
        deliveredAt: data?.delivered_at || null
      } as unknown as Notification;
    });

    // Get the last document for pagination
    const lastDoc = queryResult.data[queryResult.data.length - 1];
    const nextCursor = lastDoc ? lastDoc.id : null;

    return {
      notifications,
      unreadCount: 0, // Will be calculated separately if needed
      totalCount: notifications.length,
      hasMore: queryResult.data.length === (options.limit || 20),
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
    const dbService = getDatabaseService();

    // First read the notification to verify ownership
    const readResult = await dbService.read('notifications', notificationId);

    if (!readResult.success || !readResult.data) {
      throw new Error('Notification not found');
    }

    const notification = readResult.data.data || readResult.data;
    if (notification.user_id !== userId) {
      throw new Error('Unauthorized access to notification');
    }

    // Update the notification
    const updateData = {
      ...notification,
      read_at: new Date(),
      status: NotificationStatus.READ,
      updated_at: new Date()
    };

    const updateResult = await dbService.update('notifications', notificationId, updateData);
    if (!updateResult.success) {
      throw new Error('Failed to update notification');
    }

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
    const dbService = getDatabaseService();

    // Use raw SQL query to update all unread notifications for this user
    // Since the database abstraction layer might not support bulk updates,
    // we'll use the query method to find notifications and then update them individually
    const queryResult = await dbService.query({
      collection: 'notifications',
      filters: [
        { field: 'user_id', operator: '==' as const, value: userId },
        { field: 'read_at', operator: '==' as const, value: null }
      ],
      pagination: { limit: 1000 } // Reasonable limit for bulk operations
    });

    if (!queryResult.success || queryResult.data.length === 0) {
      return 0;
    }

    // Update each notification individually
    const updatePromises = queryResult.data.map(notification =>
      dbService.update('notifications', notification.id, {
        ...notification.data,
        read_at: new Date(),
        status: NotificationStatus.READ,
        updated_at: new Date()
      })
    );

    await Promise.all(updatePromises);

    console.log(`NotificationService: Marked ${queryResult.data.length} notifications as read`);
    return queryResult.data.length;

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
    const dbService = getDatabaseService();

    // First read the notification to verify ownership
    const readResult = await dbService.read('notifications', notificationId);

    if (!readResult.success || !readResult.data) {
      throw new Error('Notification not found');
    }

    const notification = readResult.data.data || readResult.data;
    if (notification.user_id !== userId) {
      throw new Error('Unauthorized access to notification');
    }

    // Delete the notification
    const deleteResult = await dbService.delete('notifications', notificationId);
    if (!deleteResult.success) {
      throw new Error('Failed to delete notification');
    }

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
    const dbService = getDatabaseService();

    // Query all notifications for this user
    const queryResult = await dbService.query({
      collection: 'notifications',
      filters: [{ field: 'user_id', operator: '==' as const, value: userId }],
      pagination: { limit: 1000 } // Reasonable limit for stats
    });

    if (!queryResult.success) {
      throw new Error('Failed to query notifications');
    }

    const notifications = queryResult.data.map(notification => ({
      ...notification.data,
      createdAt: notification.data?.created_at || new Date()
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
    // Use database abstraction layer
    const dbService = getDatabaseService();
    const result = await dbService.read('notification_preferences', userId);

    if (!result.success || !result.data) {
      return null;
    }

    const data = result.data.data || result.data;
    return {
      ...data,
      updatedAt: data?.updated_at || new Date()
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
    const dbService = getDatabaseService();

    // Read current preferences
    const readResult = await dbService.read('notification_preferences', userId);
    const currentPrefs = readResult.success && readResult.data ? (readResult.data.data || readResult.data) : {};

    // Update preferences
    const updatedPrefs = {
      ...currentPrefs,
      ...preferences,
      updated_at: new Date()
    };

    const updateResult = await dbService.update('notification_preferences', userId, updatedPrefs);
    if (!updateResult.success) {
      throw new Error('Failed to update notification preferences');
    }

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

    // Update in database using abstraction layer
    const dbService = getDatabaseService();
    const updateResult = await dbService.update('notifications', notification.id, {
      ...notification,
      updated_at: new Date()
    });

    if (!updateResult.success) {
      throw new Error('Failed to update notification delivery status');
    }

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