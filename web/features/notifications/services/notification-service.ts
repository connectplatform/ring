/**
 * Notification Service
 * Unread counts are a live COUNT plus publishToUserTunnel.
 * Do not wrap the count in React cache() — that would pin the badge for the request.
 */

import { db } from '@/lib/database';

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

// Import FCM service
// TODO: Implement db abstraction for messaging service
//import { getMessaging } from 'firebase-admin/messaging';
//import { MulticastMessage } from 'firebase-admin/messaging';
import { FCMService } from './fcm-service';
import { determineChannels } from '@/features/notifications/lib/determine-channels';
import { ttlSecondsForNotificationType, webPushUrgencyForType } from '@/features/notifications/lib/push-ttl';
import {
  dualPushDeliveryStatus,
  EMPTY_PUSH_STACK,
  settleToPushStack,
  summarizeDualPush,
  type PushStackResult,
} from '@/lib/notifications/push-dual-dispatch';

const fcmService = new FCMService();

/**
 * PHASE 1: Publish unread count + inbox push via tunnel for real-time UI updates
 */
async function publishUnreadCountForUser(userId: string): Promise<void> {
  try {
    const { publishToUserTunnel } = await import('@/lib/tunnel/publisher');
    const countResult = await db().countDocs('notifications', [
      { field: 'user_id', operator: '==', value: userId },
      { field: 'read_at', operator: '==', value: null },
    ]);
    const unreadCount = countResult.success ? (countResult.data ?? 0) : 0;
    await publishToUserTunnel(userId, 'notifications:unread', {
      unreadCount,
      timestamp: Date.now(),
    });
  } catch (userError) {
    console.warn(`NotificationService: Failed to publish unread count for user ${userId}:`, userError);
  }
}

async function publishUnreadCountUpdates(notifications: Notification[]): Promise<void> {
  try {
    const userIds = [...new Set(notifications.map((n) => n.userId))];
    await Promise.allSettled(userIds.map((userId) => publishUnreadCountForUser(userId)));
  } catch (error) {
    console.error('NotificationService: Error publishing tunnel unread updates:', error);
  }
}

function toInboxNotificationPayload(notification: Notification) {
  return {
    id: notification.id,
    userId: notification.userId,
    title: notification.title,
    body: notification.body,
    type: notification.type,
    priority: notification.priority,
    status: notification.status,
    trigger: notification.trigger,
    channels: notification.channels,
    actionText: notification.actionText,
    actionUrl: notification.actionUrl,
    createdAt: notification.createdAt,
    readAt: notification.readAt ?? null,
    data: notification.data ?? {},
  };
}

type InboxTunnelAction = 'notification' | 'read' | 'read_all' | 'delete' | 'restore';

async function publishInboxEvent(
  userId: string,
  event: {
    action: InboxTunnelAction;
    notificationId?: string;
    notification?: Notification;
  },
): Promise<void> {
  try {
    const { publishToUserTunnel } = await import('@/lib/tunnel/publisher');
    await publishToUserTunnel(userId, 'notifications:inbox', {
      action: event.action,
      notificationId: event.notificationId,
      notification: event.notification ? toInboxNotificationPayload(event.notification) : undefined,
      timestamp: Date.now(),
    });
  } catch (userError) {
    console.warn(`NotificationService: Failed to publish inbox event for user ${userId}:`, userError);
  }
}

async function publishInboxUpdates(notifications: Notification[]): Promise<void> {
  try {
    for (const notification of notifications) {
      await publishInboxEvent(notification.userId, {
        action: 'notification',
        notification,
      });
    }
  } catch (error) {
    console.error('NotificationService: Error publishing tunnel inbox updates:', error);
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

      // Quiet hours run once, on the preferences just loaded. Deliveries are
      // built from this list, so a muted PUSH never reaches FCM.
      const priority = request.priority || NotificationPriority.NORMAL
      const channels = determineChannels(request.channels, preferences, priority);

      const notificationData = {
        user_id: userId,
        type: request.type,
        priority,
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
      const createResult = await db().createDoc('notifications', notificationData);
      if (!createResult.success || !createResult.data) {
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
      await publishInboxUpdates(notifications);
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
 * Get user notifications with pagination (SD3)
 *
 * Raw SQL via the sanctioned escape hatch (same as markAllNotificationsAsRead):
 * queryDocs only supports `==` filters, but soft-deleted rows must be excluded
 * (`status <> 'deleted'`), so the list path needs a negation. Cursor pagination
 * keys on (created_at, id) so id-only cursors stay opaque to clients.
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
    const limit = options.limit || 20;

    // Fetch limit+1 to compute hasMore without a second count query.
    const params: unknown[] = [userId, limit + 1];
    const conditions: string[] = [
      `data->>'user_id' = $1`,
      // SD3: soft-deleted rows never resurface in feeds.
      `COALESCE(data->>'status', '') <> 'deleted'`,
    ];

    if (options.unreadOnly) {
      conditions.push(`data->>'read_at' IS NULL`);
    }

    if (options.types && options.types.length > 0) {
      params.push(options.types);
      conditions.push(`data->>'type' = ANY($${params.length}::text[])`);
    }

    if (options.startAfter) {
      params.push(options.startAfter);
      const cursorIdx = params.length;
      conditions.push(
        `(created_at, id) < ((SELECT created_at, id FROM notifications WHERE id = $${cursorIdx}))`,
      );
    }

    const { getSharedPgPool } = await import('@/lib/database/shared-pg-pool');
    const pool = await getSharedPgPool();

    const result = await pool.query(
      `SELECT id, data, created_at, updated_at
         FROM notifications
        WHERE ${conditions.join('\n          AND ')}
        ORDER BY created_at DESC, id DESC
        LIMIT $2`,
      params,
    );

    const rows = (result.rows ?? []) as Array<Record<string, unknown>>;
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const notifications = page.map(row => {
      const data = (row.data || {}) as Record<string, unknown>;
      return {
        id: row.id,
        ...data,
        createdAt: row.created_at || new Date(),
        readAt: data.read_at || null,
        deliveredAt: data.delivered_at || null,
      };
    }) as unknown as Notification[];

    const lastDoc = page[page.length - 1];
    const nextCursor = lastDoc ? String(lastDoc.id) : undefined;

    return {
      notifications,
      unreadCount: 0, // Will be calculated separately if needed
      totalCount: notifications.length,
      hasMore,
      lastVisible: nextCursor
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
    // First read the notification to verify ownership
    const readResult = await db().readDoc('notifications', notificationId);

    if (!readResult.success || !readResult.data) {
      throw new Error('Notification not found');
    }

    const notification = readResult.data;
    if (notification.user_id !== userId) {
      throw new Error('Unauthorized access to notification');
    }

    // SD: never flip a soft-deleted row back to READ.
    if (notification.status === NotificationStatus.DELETED) {
      return;
    }

    // Update the notification
    const updateData = {
      ...notification,
      read_at: new Date(),
      status: NotificationStatus.READ,
      updated_at: new Date()
    };

    const updateResult = await db().updateDoc('notifications', notificationId, updateData);
    if (!updateResult.success) {
      throw new Error('Failed to update notification');
    }

    try {
      await publishUnreadCountForUser(userId);
      await publishInboxEvent(userId, {
        action: 'read',
        notificationId,
      });
    } catch (tunnelError) {
      console.warn('NotificationService: Failed to publish tunnel updates after mark read:', tunnelError);
    }

  } catch (error) {
    console.error('NotificationService: Error marking notification as read:', error);
    throw new Error(`Failed to mark notification as read: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Mark all notifications as read for a user
 *
 * Single bulk UPDATE via the sanctioned raw-SQL escape hatch — the previous
 * implementation queried up to 1000 unread docs then Promise.all'ed 1000
 * concurrent updateDoc calls (N+1), blowing past the client's 10s read-all
 * timeout on large inboxes (greenfood.live abort storm, 2026-10-02).
 *
 * @param userId - The user ID
 * @returns Promise<number> - Number of notifications marked as read
 */
export async function markAllNotificationsAsRead(userId: string): Promise<number> {
  console.log('NotificationService: Marking all notifications as read', { userId });

  try {
    const { getSharedPgPool } = await import('@/lib/database/shared-pg-pool');
    const pool = await getSharedPgPool();

    const readAtIso = new Date().toISOString();
    const result = await pool.query(
      `UPDATE notifications
         SET data = data || jsonb_build_object(
               'read_at', $2::text,
               'status', $3::text,
               'updated_at', $2::text
             ),
             updated_at = now()
       WHERE data->>'user_id' = $1
         AND data->>'read_at' IS NULL
         AND COALESCE(data->>'status', '') <> 'deleted'
       RETURNING id`,
      [userId, readAtIso, NotificationStatus.READ],
    );

    const markedCount = result.rowCount ?? 0;

    if (markedCount === 0) {
      return 0;
    }

    console.log(`NotificationService: Marked ${markedCount} notifications as read`);

    try {
      await publishUnreadCountForUser(userId);
      await publishInboxEvent(userId, { action: 'read_all' });
    } catch (tunnelError) {
      console.warn('NotificationService: Failed to publish tunnel updates after mark all read:', tunnelError);
    }

    return markedCount;

  } catch (error) {
    console.error('NotificationService: Error marking all notifications as read:', error);
    throw new Error(`Failed to mark all notifications as read: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Soft-delete a notification (SD2)
 *
 * Flips status to DELETED and stamps deleted_at + the previous status
 * (for undo). The row stays in the DB — hidden from feeds/counts by the
 * status filter (SD3) and hard-purged by the retention cron (SD6).
 *
 * Tunnel contract is byte-identical to hard delete: clients remove the
 * row from view on the `delete` event — no client change needed.
 *
 * @param notificationId - The notification ID
 * @param userId - The user ID (for security)
 * @returns Promise<void>
 */
export async function deleteNotification(
  notificationId: string,
  userId: string
): Promise<void> {
  console.log('NotificationService: Soft-deleting notification', { notificationId, userId });

  try {
    const readResult = await db().readDoc('notifications', notificationId);

    if (!readResult.success || !readResult.data) {
      throw new Error('Notification not found');
    }

    const notification = readResult.data;
    if (notification.user_id !== userId) {
      throw new Error('Unauthorized access to notification');
    }

    if (notification.status === NotificationStatus.DELETED) {
      // Idempotent: already soft-deleted — republish the event so a late
      // client still removes the row, then return success.
      try {
        await publishUnreadCountForUser(userId);
        await publishInboxEvent(userId, { action: 'delete', notificationId });
      } catch (tunnelError) {
        console.warn('NotificationService: Failed to publish tunnel updates after delete:', tunnelError);
      }
      return;
    }

    const previousStatus = (notification.status as NotificationStatus) || NotificationStatus.SENT;

    const updateData = {
      ...notification,
      status: NotificationStatus.DELETED,
      deleted_at: new Date(),
      deleted_from: previousStatus,
      updated_at: new Date()
    };

    const updateResult = await db().updateDoc('notifications', notificationId, updateData);
    if (!updateResult.success) {
      throw new Error('Failed to delete notification');
    }

    try {
      await publishUnreadCountForUser(userId);
      await publishInboxEvent(userId, { action: 'delete', notificationId });
    } catch (tunnelError) {
      console.warn('NotificationService: Failed to publish tunnel updates after delete:', tunnelError);
    }

  } catch (error) {
    console.error('NotificationService: Error deleting notification:', error);
    throw new Error(`Failed to delete notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Restore a soft-deleted notification (SD5 undo)
 *
 * Reverts status to the pre-delete value, clears delete bookkeeping, and
 * publishes a `restore` tunnel event carrying the full row so open feeds
 * re-insert it live.
 */
export async function restoreNotification(
  notificationId: string,
  userId: string
): Promise<void> {
  console.log('NotificationService: Restoring notification', { notificationId, userId });

  try {
    const readResult = await db().readDoc('notifications', notificationId);

    if (!readResult.success || !readResult.data) {
      throw new Error('Notification not found');
    }

    const notification = readResult.data;
    if (notification.user_id !== userId) {
      throw new Error('Unauthorized access to notification');
    }

    if (notification.status !== NotificationStatus.DELETED) {
      // Idempotent: nothing to restore.
      return;
    }

    const restoredStatus =
      (notification.deleted_from as NotificationStatus) || NotificationStatus.SENT;

    const restoredAt = notification.created_at
      ? new Date(String(notification.created_at))
      : new Date();

    const updateData = {
      ...notification,
      status: restoredStatus,
      deleted_at: null,
      deleted_from: null,
      updated_at: new Date()
    };

    const updateResult = await db().updateDoc('notifications', notificationId, updateData);
    if (!updateResult.success) {
      throw new Error('Failed to restore notification');
    }

    try {
      await publishUnreadCountForUser(userId);
      await publishInboxEvent(userId, {
        action: 'restore',
        notificationId,
        notification: {
          id: notificationId,
          userId,
          title: String(notification.title ?? ''),
          body: String(notification.body ?? ''),
          type: notification.type as NotificationType,
          priority: notification.priority as NotificationPriority,
          status: restoredStatus,
          trigger: (notification.trigger_type as NotificationTrigger) || NotificationTrigger.SYSTEM_EVENT,
          channels: (notification.channels as NotificationChannel[]) || [NotificationChannel.IN_APP],
          deliveries: (notification.deliveries as Notification['deliveries']) || [],
          data: (notification.data as Notification['data']) || {},
          createdAt: restoredAt,
          readAt: notification.read_at ? new Date(String(notification.read_at)) : undefined,
          actionText: notification.action_text as string | undefined,
          actionUrl: notification.action_url as string | undefined,
        },
      });
    } catch (tunnelError) {
      console.warn('NotificationService: Failed to publish tunnel updates after restore:', tunnelError);
    }

  } catch (error) {
    console.error('NotificationService: Error restoring notification:', error);
    throw new Error(`Failed to restore notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    const queryResult = await db().queryDocs({
      collection: 'notifications',
      filters: [{ field: 'user_id', operator: '==' as const, value: userId }],
      pagination: { limit: 1000 }
    });

    if (!queryResult.success) {
      throw new Error('Failed to query notifications');
    }

    const notifications = (queryResult.data.map(row => ({
      ...row,
      createdAt: row.created_at || new Date(),
      readAt: row.read_at || null
    })) as unknown as Notification[]).filter(n => n.status !== NotificationStatus.DELETED);

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
    const result = await db().readDoc<DetailedNotificationPreferences & Record<string, unknown>>(
      'notification_preferences',
      userId
    );

    if (!result.success || !result.data) {
      return null;
    }

    const data = result.data;
    return {
      ...data,
      updatedAt: (data.updated_at as Date | string | undefined) ?? data.updatedAt ?? new Date(),
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
    const readResult = await db().readDoc<DetailedNotificationPreferences & Record<string, unknown>>(
      'notification_preferences',
      userId,
    )

    const now = new Date()
    const currentPrefs: Partial<DetailedNotificationPreferences> =
      readResult.success && readResult.data ? readResult.data : {}

    const currentChannels =
      currentPrefs.channels && typeof currentPrefs.channels === 'object'
        ? currentPrefs.channels
        : undefined
    const currentTypes =
      currentPrefs.types && typeof currentPrefs.types === 'object' ? currentPrefs.types : undefined
    const currentQuiet =
      currentPrefs.quietHours && typeof currentPrefs.quietHours === 'object'
        ? currentPrefs.quietHours
        : undefined
    const currentFrequency =
      currentPrefs.frequency && typeof currentPrefs.frequency === 'object'
        ? currentPrefs.frequency
        : undefined

    const updatedPrefs = {
      ...currentPrefs,
      ...preferences,
      ...(currentChannels || preferences.channels
        ? { channels: { ...currentChannels, ...preferences.channels } }
        : {}),
      ...(currentTypes || preferences.types
        ? { types: { ...currentTypes, ...preferences.types } }
        : {}),
      ...(currentQuiet || preferences.quietHours
        ? { quietHours: { ...currentQuiet, ...preferences.quietHours } }
        : {}),
      ...(currentFrequency || preferences.frequency
        ? { frequency: { ...currentFrequency, ...preferences.frequency } }
        : {}),
      updated_at: now,
      updatedAt: now,
    }

    if (readResult.success && readResult.data) {
      const updateResult = await db().updateDoc('notification_preferences', userId, updatedPrefs)
      if (!updateResult.success) {
        throw updateResult.error ?? new Error('Failed to update notification preferences')
      }
      return
    }

    const createResult = await db().createDoc('notification_preferences', updatedPrefs, { id: userId })
    if (!createResult.success) {
      throw createResult.error ?? new Error('Failed to create notification preferences')
    }
  } catch (error) {
    console.error('NotificationService: Error updating user preferences:', error)
    throw new Error(
      `Failed to update notification preferences: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

/**
 * Helper functions
 */

function shouldSendNotification(
  type: NotificationType,
  preferences: DetailedNotificationPreferences | null
): boolean {
  if (!preferences) return true
  if (preferences.enabled === false) return false
  return preferences.types?.[type] !== false
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

            case NotificationChannel.PUSH: {
              // Per-user fan-out: FCM Admin → fcm_tokens, RFC web-push → push_subscriptions.
              // Chrome FCM-owned devices have empty RFC rows (no-op). Safari RFC-only has empty FCM.
              const [fcmSettled, rfcSettled] = await Promise.allSettled([
                sendFCMNotification(notification),
                sendWebPushNotification(notification),
              ])
              const fcm = settleToPushStack(fcmSettled)
              const rfc = settleToPushStack(rfcSettled)
              const outcome = summarizeDualPush(fcm, rfc)
              const dualStatus = dualPushDeliveryStatus(outcome)
              console.log('[push-dual]', {
                notificationId: notification.id,
                userId: notification.userId,
                type: notification.type,
                fcm,
                rfc,
                status: dualStatus,
              })
              if (dualStatus === 'failed') {
                delivery.status = NotificationStatus.FAILED
                delivery.failureReason = `FCM ${fcm.sent}/${fcm.attempted} RFC ${rfc.sent}/${rfc.attempted}`
              } else if (dualStatus === 'noop') {
                delivery.status = NotificationStatus.CANCELLED
                delivery.failureReason = 'No active push subscriptions'
              } else {
                delivery.status = NotificationStatus.DELIVERED
                delivery.deliveredAt = new Date()
              }
              break
            }

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
    const updateResult = await db().updateDoc('notifications', notification.id, {
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

async function sendFCMNotification(notification: Notification): Promise<PushStackResult> {
  try {
    return await fcmService.sendToUser(notification.userId, {
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
      tag: `${notification.type}-${notification.id}`,
      ttlSeconds: ttlSecondsForNotificationType(notification.type),
    });
  } catch (error) {
    console.error('Error sending FCM notification:', error);
    throw error;
  }
}

async function sendWebPushNotification(notification: Notification): Promise<PushStackResult> {
  try {
    const { webPushService, isWebPushConfigured } = await import('./webpush-service')
    if (!isWebPushConfigured()) return EMPTY_PUSH_STACK
    return await webPushService.sendToUser(notification.userId, {
      title: notification.title,
      body: notification.body,
      icon: '/icons/notification-icon.png',
      badge: '/icons/badge-icon.png',
      data: {
        notificationId: notification.id,
        type: notification.type,
        ...(notification.actionUrl && { clickAction: notification.actionUrl }),
        ...(notification.data &&
          Object.fromEntries(
            Object.entries(notification.data).map(([key, value]) => [
              key,
              typeof value === 'object' ? JSON.stringify(value) : String(value),
            ]),
          )),
      },
      clickAction: notification.actionUrl,
      tag: `${notification.type}-${notification.id}`,
      ttlSeconds: ttlSecondsForNotificationType(notification.type),
      urgency: webPushUrgencyForType(notification.type),
    })
  } catch (error) {
    console.warn('Error sending web-push notification (non-fatal):', error)
    return { attempted: 0, sent: 0, failed: 1 }
  }
} 
/**
 * Hard-purge soft-deleted notifications past the retention window (SD6).
 *
 * Tunnel contract untouched: rows leaving the DB are already invisible to
 * feeds/counts (status='deleted'). Runs from /api/cron/cleanup-notifications-deleted.
 */
export async function purgeDeletedNotifications(retentionDays = 30): Promise<{ purged: number }> {
  console.log('NotificationService: Purging soft-deleted notifications', { retentionDays });

  try {
    const { getSharedPgPool } = await import('@/lib/database/shared-pg-pool');
    const pool = await getSharedPgPool();

    const result = await pool.query(
      `DELETE FROM notifications
        WHERE COALESCE(data->>'status', '') = 'deleted'
          AND COALESCE(data->>'deleted_at', '') <> ''
          AND (data->>'deleted_at')::timestamptz < now() - ($1 || ' days')::interval
        RETURNING id`,
      [String(retentionDays)],
    );

    const purged = result.rowCount ?? 0;
    console.log(`NotificationService: Purged ${purged} soft-deleted notifications (>${retentionDays}d)`);
    return { purged };
  } catch (error) {
    console.error('NotificationService: Error purging deleted notifications:', error);
    throw new Error(`Failed to purge deleted notifications: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
