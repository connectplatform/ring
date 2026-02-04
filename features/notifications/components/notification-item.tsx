/**
 * Notification Item Component
 * Displays individual notifications in lists with actions and status
 */

'use client';

import React, { useState } from 'react';
import { 
  Bell, 
  AlertCircle, 
  CheckCircle, 
  Info, 
  AlertTriangle,
  ExternalLink,
  Check,
  Loader2,
  Clock,
  User,
  Building,
  Wallet,
  Settings as SettingsIcon,
  MessageSquare,
  Heart,
  DollarSign
} from 'lucide-react';
import { Notification, NotificationType, NotificationPriority } from '@/features/notifications/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNotificationNavigation } from '@/hooks/use-notification-navigation';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsReadAction: (id: string) => Promise<boolean>;
  onMarkAsUnreadAction?: (id: string) => void;
  onDeleteAction?: (id: string) => void;
  onClickAction?: () => void;
  showActions?: boolean;
  compact?: boolean;
  className?: string;
}

const priorityStyles = {
  low: 'border-l-blue-500',
  normal: 'border-l-gray-400',
  high: 'border-l-orange-500',
  urgent: 'border-l-red-500'
};

const priorityIcons = {
  low: Info,
  normal: Bell,
  high: AlertTriangle,
  urgent: AlertCircle
};

const typeIcons = {
  [NotificationType.OPPORTUNITY_CREATED]: Building,
  [NotificationType.OPPORTUNITY_UPDATED]: Building,
  [NotificationType.OPPORTUNITY_EXPIRED]: Building,
  [NotificationType.OPPORTUNITY_SAVED]: Building,
  [NotificationType.OPPORTUNITY_APPLIED]: Building,
  [NotificationType.ENTITY_CREATED]: User,
  [NotificationType.ENTITY_UPDATED]: User,
  [NotificationType.ENTITY_VERIFIED]: CheckCircle,
  [NotificationType.ENTITY_REJECTED]: AlertCircle,
  [NotificationType.ACCOUNT_VERIFICATION]: User,
  [NotificationType.ROLE_UPGRADE_REQUEST]: User,
  [NotificationType.ROLE_UPGRADE_APPROVED]: CheckCircle,
  [NotificationType.ROLE_UPGRADE_REJECTED]: AlertCircle,
  [NotificationType.PROFILE_UPDATE]: User,
  [NotificationType.WALLET_CREATED]: Wallet,
  [NotificationType.WALLET_TRANSACTION]: Wallet,
  [NotificationType.WALLET_BALANCE_LOW]: AlertTriangle,
  [NotificationType.SYSTEM_MAINTENANCE]: SettingsIcon,
  [NotificationType.SYSTEM_UPDATE]: Info,
  [NotificationType.SECURITY_ALERT]: AlertCircle,
  [NotificationType.MESSAGE_RECEIVED]: Bell,
  [NotificationType.MENTION_RECEIVED]: Bell,
  [NotificationType.FOLLOW_REQUEST]: User,
  [NotificationType.KYC_REQUIRED]: AlertTriangle,
  [NotificationType.KYC_APPROVED]: CheckCircle,
  [NotificationType.KYC_REJECTED]: AlertCircle,
  [NotificationType.KYC_EXPIRING]: Clock,
  system: SettingsIcon,
  comment: MessageSquare,
  like: Heart,
  payment: DollarSign,
  general: Bell
};

const typeLabels = {
  [NotificationType.OPPORTUNITY_CREATED]: 'Opportunity',
  [NotificationType.OPPORTUNITY_UPDATED]: 'Opportunity',
  [NotificationType.OPPORTUNITY_EXPIRED]: 'Opportunity',
  [NotificationType.OPPORTUNITY_SAVED]: 'Opportunity',
  [NotificationType.OPPORTUNITY_APPLIED]: 'Opportunity',
  [NotificationType.ENTITY_CREATED]: 'Entity',
  [NotificationType.ENTITY_UPDATED]: 'Entity',
  [NotificationType.ENTITY_VERIFIED]: 'Entity',
  [NotificationType.ENTITY_REJECTED]: 'Entity',
  [NotificationType.ACCOUNT_VERIFICATION]: 'Account',
  [NotificationType.ROLE_UPGRADE_REQUEST]: 'Account',
  [NotificationType.ROLE_UPGRADE_APPROVED]: 'Account',
  [NotificationType.ROLE_UPGRADE_REJECTED]: 'Account',
  [NotificationType.PROFILE_UPDATE]: 'Profile',
  [NotificationType.WALLET_CREATED]: 'Wallet',
  [NotificationType.WALLET_TRANSACTION]: 'Wallet',
  [NotificationType.WALLET_BALANCE_LOW]: 'Wallet',
  [NotificationType.SYSTEM_MAINTENANCE]: 'System',
  [NotificationType.SYSTEM_UPDATE]: 'System',
  [NotificationType.SECURITY_ALERT]: 'Security',
  [NotificationType.MESSAGE_RECEIVED]: 'Message',
  [NotificationType.MENTION_RECEIVED]: 'Mention',
  [NotificationType.FOLLOW_REQUEST]: 'Social',
  [NotificationType.KYC_REQUIRED]: 'KYC',
  [NotificationType.KYC_APPROVED]: 'KYC',
  [NotificationType.KYC_REJECTED]: 'KYC',
  [NotificationType.KYC_EXPIRING]: 'KYC'
};

export function NotificationItem({
  notification,
  onMarkAsReadAction,
  onMarkAsUnreadAction,
  onDeleteAction,
  onClickAction,
  showActions = true,
  compact = false,
  className
}: NotificationItemProps) {
  const [isMarkingAsRead, setIsMarkingAsRead] = useState(false);
  const { navigateToUrl, isNavigating } = useNotificationNavigation();

  const isUnread = !notification.readAt;
  const Icon = typeIcons[notification.type] || priorityIcons[notification.priority] || Bell;
  const typeLabel = typeLabels[notification.type] || 'Notification';

  const handleMarkAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isUnread && !isMarkingAsRead) {
      setIsMarkingAsRead(true);
      await onMarkAsReadAction(notification.id);
      setIsMarkingAsRead(false);
    }
  };

  const handleMarkAsUnread = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMarkAsUnreadAction) {
      onMarkAsUnreadAction(notification.id);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDeleteAction) {
      onDeleteAction(notification.id);
    }
  };

  const handleClick = () => {
    if (onClickAction) {
      onClickAction();
    } else if (notification.actionUrl) {
      navigateToUrl(notification.actionUrl);
    }
    
    // Auto-mark as read when clicked
    if (isUnread) {
      onMarkAsReadAction(notification.id);
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return new Date(date).toLocaleDateString();
  };

  return (
    <div
      className={cn(
        'relative p-4 border-l-4 transition-all duration-200',
        priorityStyles[notification.priority],
        isUnread 
          ? 'bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-950/30' 
          : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800',
        onClickAction && 'cursor-pointer',
        compact && 'p-3',
        className
      )}
      onClick={handleClick}
    >
      {/* Unread indicator */}
      {isUnread && (
        <div className="absolute top-4 right-4 w-2 h-2 bg-blue-500 rounded-full"></div>
      )}

      <div className="flex items-start space-x-3">
        {/* Icon */}
        <div className={cn(
          'flex-shrink-0 p-2 rounded-full',
          isUnread ? 'bg-blue-100 dark:bg-blue-900' : 'bg-gray-100 dark:bg-gray-800'
        )}>
          <Icon className={cn(
            'w-4 h-4',
            compact && 'w-3 h-3'
          )} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-2">
              <Badge 
                variant={isUnread ? 'default' : 'secondary'} 
                className={cn('text-xs', compact && 'text-[10px] px-1 py-0')}
              >
                {typeLabel}
              </Badge>
              {notification.priority === 'urgent' && (
                <Badge variant="destructive" className={cn('text-xs', compact && 'text-[10px] px-1 py-0')}>
                  Urgent
                </Badge>
              )}
            </div>
            <span className={cn(
              'text-xs text-gray-500 dark:text-gray-400',
              compact && 'text-[10px]'
            )}>
              {formatTimeAgo(new Date(notification.createdAt))}
            </span>
          </div>

          {/* Title */}
          <h4 className={cn(
            'font-semibold text-foreground mb-1',
            compact ? 'text-sm' : 'text-base',
            isUnread && 'font-bold'
          )}>
            {notification.title}
          </h4>

          {/* Body */}
          <p className={cn(
            'text-muted-foreground mb-2',
            compact ? 'text-xs line-clamp-1' : 'text-sm line-clamp-2'
          )}>
            {notification.body}
          </p>

          {/* Actions */}
          {showActions && !compact && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {/* Action button */}
                {notification.actionText && notification.actionUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClick();
                    }}
                    className="text-xs"
                  >
                    {notification.actionText}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                )}
              </div>

              {/* Mark as read button */}
              {isUnread && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAsRead}
                  disabled={isMarkingAsRead}
                  className="text-xs"
                >
                  {isMarkingAsRead ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}
                  <span className="ml-1">Mark Read</span>
                </Button>
              )}
            </div>
          )}

          {/* Compact actions */}
          {showActions && compact && isUnread && (
            <button
              onClick={handleMarkAsRead}
              disabled={isMarkingAsRead}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {isMarkingAsRead ? 'Marking...' : 'Mark as read'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
} 