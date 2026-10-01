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
  DollarSign,
  Key,
  Coins,
  ListTodo,
  BarChart3,
  CalendarDays,
  PiggyBank,
  Gamepad2,
  Phone,
} from 'lucide-react';
import { Notification, NotificationType, NotificationPriority } from '@/features/notifications/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNotificationNavigation } from '@/hooks/use-notification-navigation';
import { useTranslations, useFormatter } from 'next-intl';

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
  normal: 'border-l-border',
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
  [NotificationType.PAYMENT_REQUEST]: Wallet,
  [NotificationType.ENV_REQUEST]: Key,
  [NotificationType.TASK_ASSIGNED]: ListTodo,
  [NotificationType.TASK_UPDATED]: ListTodo,
  [NotificationType.POLL_CREATED]: BarChart3,
  [NotificationType.POLL_CLOSED]: BarChart3,
  [NotificationType.RSVP_INVITE]: CalendarDays,
  [NotificationType.RSVP_UPDATED]: CalendarDays,
  [NotificationType.DAO_JAR_UPDATE]: PiggyBank,
  [NotificationType.GAME_REQUEST]: Gamepad2,
  [NotificationType.GAME_UPDATED]: Gamepad2,
  [NotificationType.CALL_INVITE]: Phone,
  [NotificationType.REWARD_CREDIT_RECEIVED]: Coins,
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
  [NotificationType.REFERRAL_REWARD_MINTED]: Coins,
  system: SettingsIcon,
  comment: MessageSquare,
  like: Heart,
  payment: DollarSign,
  general: Bell
} as const;

// Map every notification type to an i18n category key (item.categories.*)
const typeCategories = {
  [NotificationType.OPPORTUNITY_CREATED]: 'opportunity',
  [NotificationType.OPPORTUNITY_UPDATED]: 'opportunity',
  [NotificationType.OPPORTUNITY_EXPIRED]: 'opportunity',
  [NotificationType.OPPORTUNITY_SAVED]: 'opportunity',
  [NotificationType.OPPORTUNITY_APPLIED]: 'opportunity',
  [NotificationType.ENTITY_CREATED]: 'entity',
  [NotificationType.ENTITY_UPDATED]: 'entity',
  [NotificationType.ENTITY_VERIFIED]: 'entity',
  [NotificationType.ENTITY_REJECTED]: 'entity',
  [NotificationType.ACCOUNT_VERIFICATION]: 'account',
  [NotificationType.ROLE_UPGRADE_REQUEST]: 'account',
  [NotificationType.ROLE_UPGRADE_APPROVED]: 'account',
  [NotificationType.ROLE_UPGRADE_REJECTED]: 'account',
  [NotificationType.PROFILE_UPDATE]: 'profile',
  [NotificationType.WALLET_CREATED]: 'wallet',
  [NotificationType.WALLET_TRANSACTION]: 'wallet',
  [NotificationType.WALLET_BALANCE_LOW]: 'wallet',
  [NotificationType.PAYMENT_REQUEST]: 'payment',
  [NotificationType.ENV_REQUEST]: 'security',
  [NotificationType.TASK_ASSIGNED]: 'task',
  [NotificationType.TASK_UPDATED]: 'task',
  [NotificationType.POLL_CREATED]: 'poll',
  [NotificationType.POLL_CLOSED]: 'poll',
  [NotificationType.RSVP_INVITE]: 'rsvp',
  [NotificationType.RSVP_UPDATED]: 'rsvp',
  [NotificationType.DAO_JAR_UPDATE]: 'dao',
  [NotificationType.GAME_REQUEST]: 'game',
  [NotificationType.GAME_UPDATED]: 'game',
  [NotificationType.CALL_INVITE]: 'call',
  [NotificationType.REWARD_CREDIT_RECEIVED]: 'reward',
  [NotificationType.SYSTEM_MAINTENANCE]: 'system',
  [NotificationType.SYSTEM_UPDATE]: 'system',
  [NotificationType.SECURITY_ALERT]: 'security',
  [NotificationType.MESSAGE_RECEIVED]: 'message',
  [NotificationType.MENTION_RECEIVED]: 'message',
  [NotificationType.FOLLOW_REQUEST]: 'social',
  [NotificationType.KYC_REQUIRED]: 'kyc',
  [NotificationType.KYC_APPROVED]: 'kyc',
  [NotificationType.KYC_REJECTED]: 'kyc',
  [NotificationType.KYC_EXPIRING]: 'kyc',
  [NotificationType.REFERRAL_REWARD_MINTED]: 'referral',
  system: 'system',
  comment: 'message',
  like: 'social',
  payment: 'payment',
  general: 'general'
} as const;

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
  const { navigateToUrl } = useNotificationNavigation();
  const t = useTranslations('modules.notifications.item');
  const format = useFormatter();

  const isUnread = !notification.readAt;
  const Icon = typeIcons[notification.type] || priorityIcons[notification.priority] || Bell;
  const categoryKey = typeCategories[notification.type] ?? 'defaultCategory';
  const typeLabel = t.has(`categories.${categoryKey}`)
    ? t(`categories.${categoryKey}`)
    : t('defaultCategory');

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const formatTimeAgo = (date: Date) => {
    const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return t('justNow');
    if (diffInSeconds < 3600) return t('minutesAgo', { count: Math.floor(diffInSeconds / 60) });
    if (diffInSeconds < 86400) return t('hoursAgo', { count: Math.floor(diffInSeconds / 3600) });
    if (diffInSeconds < 604800) return t('daysAgo', { count: Math.floor(diffInSeconds / 86400) });

    return format.dateTime(date, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div
      className={cn(
        'relative p-4 border-l-4 transition-colors duration-200',
        priorityStyles[notification.priority],
        isUnread
          ? 'bg-primary/5 hover:bg-primary/10'
          : 'bg-transparent hover:bg-muted/60',
        onClickAction && 'cursor-pointer',
        compact && 'p-3',
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={onClickAction || notification.actionUrl ? 'button' : undefined}
      tabIndex={onClickAction || notification.actionUrl ? 0 : undefined}
    >
      {/* Unread indicator */}
      {isUnread && (
        <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-primary" aria-hidden />
      )}

      <div className="flex items-start space-x-3">
        {/* Icon */}
        <div className={cn(
          'flex-shrink-0 p-2 rounded-full',
          isUnread ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
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
                  {t('urgent')}
                </Badge>
              )}
            </div>
            <span className={cn(
              'text-xs text-muted-foreground tabular-nums',
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
                  <span className="ml-1">{isMarkingAsRead ? t('marking') : t('markRead')}</span>
                </Button>
              )}
            </div>
          )}

          {/* Compact actions */}
          {showActions && compact && isUnread && (
            <button
              onClick={handleMarkAsRead}
              disabled={isMarkingAsRead}
              className="text-xs text-primary hover:underline"
            >
              {isMarkingAsRead ? t('marking') : t('markAsRead')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
