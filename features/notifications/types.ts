/**
 * Notification System Types
 * Defines the complete notification system structure for Ring platform
 */

import { UserRole } from '@/features/auth/types';

/**
 * NotificationType enum
 * Defines all possible notification types in the system
 */
export enum NotificationType {
  // Opportunities
  OPPORTUNITY_CREATED = 'opportunity_created',
  OPPORTUNITY_UPDATED = 'opportunity_updated',
  OPPORTUNITY_EXPIRED = 'opportunity_expired',
  OPPORTUNITY_SAVED = 'opportunity_saved',
  OPPORTUNITY_APPLIED = 'opportunity_applied',
  OPPORTUNITY_MATCHED_AI = 'opportunity_matched_ai', // AI-powered match notification
  
  // Entities
  ENTITY_CREATED = 'entity_created',
  ENTITY_UPDATED = 'entity_updated',
  ENTITY_VERIFIED = 'entity_verified',
  ENTITY_REJECTED = 'entity_rejected',
  
  // User Account
  ACCOUNT_VERIFICATION = 'account_verification',
  ROLE_UPGRADE_REQUEST = 'role_upgrade_request',
  ROLE_UPGRADE_APPROVED = 'role_upgrade_approved',
  ROLE_UPGRADE_REJECTED = 'role_upgrade_rejected',
  PROFILE_UPDATE = 'profile_update',
  
  // Wallet
  WALLET_CREATED = 'wallet_created',
  WALLET_TRANSACTION = 'wallet_transaction',
  WALLET_BALANCE_LOW = 'wallet_balance_low',
  
  // System
  SYSTEM_MAINTENANCE = 'system_maintenance',
  SYSTEM_UPDATE = 'system_update',
  SECURITY_ALERT = 'security_alert',
  
  // Social
  MESSAGE_RECEIVED = 'message_received',
  MENTION_RECEIVED = 'mention_received',
  FOLLOW_REQUEST = 'follow_request',
  
  // KYC
  KYC_REQUIRED = 'kyc_required',
  KYC_APPROVED = 'kyc_approved',
  KYC_REJECTED = 'kyc_rejected',
  KYC_EXPIRING = 'kyc_expiring'
}

/**
 * NotificationPriority enum
 * Priority levels for notifications
 */
export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

/**
 * NotificationStatus enum
 * Status of a notification
 */
export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * NotificationChannel enum
 * Available delivery channels
 */
export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push'
}

/**
 * NotificationTrigger enum
 * What triggered the notification
 */
export enum NotificationTrigger {
  USER_ACTION = 'user_action',
  SYSTEM_EVENT = 'system_event',
  SCHEDULED = 'scheduled',
  ADMIN_ACTION = 'admin_action'
}

/**
 * NotificationData interface
 * Dynamic data payload for different notification types
 */
export interface NotificationData {
  // Opportunity-related data
  opportunityId?: string;
  opportunityTitle?: string;
  opportunityType?: string;
  opportunityCategory?: string;

  // AI Matcher-specific data
  matchScore?: number;
  matchReason?: string;
  matchFactors?: {
    skillMatch?: number;
    experienceMatch?: number;
    industryMatch?: number;
    locationMatch?: number;
    budgetMatch?: number;
    availabilityMatch?: number;
    careerMatch?: number;
    cultureMatch?: number;
  };
  overallMatchScore?: number;
  
  // Entity-related data
  entityId?: string;
  entityName?: string;
  entityType?: string;
  
  // User-related data
  userId?: string;
  userName?: string;
  userRole?: UserRole;
  
  // Wallet-related data
  walletAddress?: string;
  transactionHash?: string;
  amount?: string;
  currency?: string;
  
  // System-related data
  maintenanceWindow?: string;
  updateVersion?: string;
  securityReason?: string;
  
  // URLs and links
  actionUrl?: string;
  documentUrl?: string;
  profileUrl?: string;
  
  // Additional metadata
  metadata?: Record<string, any>;
}

/**
 * NotificationTemplate interface
 * Template structure for notifications
 */
export interface NotificationTemplate {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  actionText?: string;
  actionUrl?: string;
  emailSubject?: string;
  emailBody?: string;
  smsBody?: string;
  pushTitle?: string;
  pushBody?: string;
  icon?: string;
  image?: string;
  supportedChannels: NotificationChannel[];
  variables: string[]; // Template variables like {{userName}}, {{opportunityTitle}}
  requiredRoles?: UserRole[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * NotificationDelivery interface
 * Delivery status for each channel
 */
export interface NotificationDelivery {
  channel: NotificationChannel;
  status: NotificationStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  failureReason?: string;
  retryCount: number;
  lastRetryAt?: Date;
}

/**
 * Notification interface
 * Main notification structure
 */
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  priority: NotificationPriority;
  status: NotificationStatus;
  trigger: NotificationTrigger;
  
  // Content
  title: string;
  body: string;
  icon?: string;
  image?: string;
  actionText?: string;
  actionUrl?: string;
  
  // Data payload
  data: NotificationData;
  
  // Delivery tracking
  channels: NotificationChannel[];
  deliveries: NotificationDelivery[];
  
  // Timestamps
  createdAt: Date;
  scheduledFor?: Date;
  readAt?: Date;
  expiresAt?: Date;
  
  // Metadata
  templateId?: string;
  batchId?: string;
  category?: string;
  tags?: string[];
  
  // Localization
  locale?: string;
}

/**
 * NotificationPreferences interface (extended from auth types)
 * User's notification preferences with granular control
 */
export interface DetailedNotificationPreferences {
  // Global settings
  enabled: boolean;
  
  // Channel preferences
  channels: {
    inApp: boolean;
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  
  // Type preferences
  types: {
    [key in NotificationType]: boolean;
  };
  
  // Timing preferences
  quietHours: {
    enabled: boolean;
    startTime: string; // HH:MM format
    endTime: string;   // HH:MM format
    timezone: string;
  };
  
  // Frequency preferences
  frequency: {
    immediate: NotificationType[];
    daily: NotificationType[];
    weekly: NotificationType[];
    monthly: NotificationType[];
  };
  
  // Contact preferences
  emailAddress?: string;
  phoneNumber?: string;
  
  // Language preference
  language: string;
  
  // Last updated
  updatedAt: Date;
}

/**
 * NotificationBatch interface
 * For bulk notifications
 */
export interface NotificationBatch {
  id: string;
  name: string;
  description?: string;
  type: NotificationType;
  templateId: string;
  targetUsers: string[]; // User IDs
  targetRoles?: UserRole[];
  scheduledFor?: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalCount: number;
  successCount: number;
  failureCount: number;
  createdBy: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  errors?: string[];
}

/**
 * NotificationSettings interface
 * System-wide notification settings
 */
export interface NotificationSettings {
  id: string;
  
  // Rate limiting
  rateLimits: {
    [key in NotificationChannel]: {
      maxPerHour: number;
      maxPerDay: number;
      maxPerWeek: number;
    };
  };
  
  // Retry settings
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    maxBackoffTime: number;
  };
  
  // Template settings
  defaultTemplates: {
    [key in NotificationType]?: string; // Template ID
  };
  
  // Feature flags
  features: {
    emailNotifications: boolean;
    smsNotifications: boolean;
    pushNotifications: boolean;
    smartNotifications: boolean;
    batchNotifications: boolean;
  };
  
  // Provider settings
  providers: {
    email: {
      provider: string;
      apiKey: string;
      fromAddress: string;
      fromName: string;
    };
    sms: {
      provider: string;
      apiKey: string;
      fromNumber: string;
    };
    push: {
      provider: string;
      serverKey: string;
      vapidPublicKey: string;
      vapidPrivateKey: string;
    };
  };
  
  updatedAt: Date;
  updatedBy: string;
}

/**
 * NotificationAnalytics interface
 * Analytics data for notifications
 */
export interface NotificationAnalytics {
  id: string;
  date: string; // YYYY-MM-DD format
  
  // Volume metrics
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalFailed: number;
  
  // Channel breakdown
  byChannel: {
    [key in NotificationChannel]: {
      sent: number;
      delivered: number;
      read: number;
      failed: number;
    };
  };
  
  // Type breakdown
  byType: {
    [key in NotificationType]: {
      sent: number;
      delivered: number;
      read: number;
      failed: number;
    };
  };
  
  // Performance metrics
  avgDeliveryTime: number; // milliseconds
  avgReadTime: number;     // milliseconds
  
  // Engagement metrics
  clickThroughRate: number;
  unsubscribeRate: number;
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * API Request/Response Types
 */

export interface CreateNotificationRequest {
  userId?: string;
  userIds?: string[];
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  body: string;
  data?: NotificationData;
  channels?: NotificationChannel[];
  scheduledFor?: Date;
  expiresAt?: Date;
  actionText?: string;
  actionUrl?: string;
  templateId?: string;
}

export interface UpdateNotificationRequest {
  title?: string;
  body?: string;
  status?: NotificationStatus;
  readAt?: Date;
  scheduledFor?: Date;
}

export interface NotificationListResponse {
  notifications: Notification[];
  unreadCount: number;
  totalCount: number;
  hasMore: boolean;
  lastVisible?: string;
}

export interface NotificationStatsResponse {
  totalNotifications: number;
  unreadCount: number;
  todayCount: number;
  weekCount: number;
  byType: Record<NotificationType, number>;
  byChannel: Record<NotificationChannel, number>;
  byStatus: Record<NotificationStatus, number>;
} 