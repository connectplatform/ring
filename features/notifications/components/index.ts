/**
 * Notification Components Index
 * Centralized exports for all notification-related components
 */

// Core components
export { NotificationCenter } from './notification-center';
export { NotificationItem } from './notification-item';
export { NotificationList } from './notification-list';
export { NotificationPreferences } from './notification-preferences';

// Toast system
export { 
  ToastNotification, 
  ToastContainer, 
  useToastNotifications 
} from './toast-notification';

// Provider and context
export { 
  NotificationProvider, 
  useNotificationContext, 
  useToast, 
  useToastHelpers 
} from './notification-provider';

// Types (re-export from features)
export type {
  Notification,
  NotificationType,
  NotificationPriority,
  NotificationStatus,
  NotificationChannel,
  NotificationListResponse,
  NotificationStatsResponse,
  DetailedNotificationPreferences
} from '@/features/notifications/types'; 