/**
 * Notification Badge Component
 * Displays unread notification count with optimized caching and real-time updates
 */

'use client';

import React from 'react';
import { Bell } from 'lucide-react';
import { useUnreadCount } from '@/hooks/use-unread-count';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface NotificationBadgeProps {
  className?: string;
  showCount?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  onClick?: () => void;
}

export function NotificationBadge({
  className,
  showCount = true,
  size = 'md',
  variant = 'destructive',
  onClick
}: NotificationBadgeProps) {
  const { unreadCount, loading, error } = useUnreadCount({
    autoRefresh: true,
    refreshInterval: 180000, // 3 minutes
    cacheTimeout: 120000 // 2 minutes cache TTL
  });

  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10'
  };

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 18
  };

  const hasUnread = unreadCount > 0;

  return (
    <div className={cn('relative inline-flex', className)}>
      <button
        onClick={onClick}
        className={cn(
          'relative inline-flex items-center justify-center rounded-full transition-colors',
          'hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          sizeClasses[size]
        )}
        disabled={loading}
      >
        <Bell 
          size={iconSizes[size]} 
          className={cn(
            'transition-colors',
            hasUnread ? 'text-primary' : 'text-muted-foreground'
          )}
        />
        
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </button>

      {showCount && hasUnread && (
        <Badge
          variant={variant}
          className={cn(
            'absolute -top-1 -right-1 h-5 min-w-[20px] rounded-full px-1 text-xs font-medium',
            'flex items-center justify-center',
            size === 'sm' && 'h-4 min-w-[16px] text-[10px]',
            size === 'lg' && 'h-6 min-w-[24px] text-sm'
          )}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}

      {error && (
        <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-destructive" 
             title={`Error: ${error}`} />
      )}
    </div>
  );
}
