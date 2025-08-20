/**
 * Toast Notification Component
 * Displays in-app toast notifications with animations and auto-dismiss
 * Enhanced with React 19 navigation
 */

// @ts-nocheck - Suppress React 19 server action warnings for client-side event handlers
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { X, Bell, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { Notification, NotificationPriority } from '@/features/notifications/types';
import { useNotificationNavigation } from '@/hooks/use-notification-navigation';
import { cn } from '@/lib/utils';

interface ToastNotificationProps {
  notification: Notification;
  onDismissAction: (id: string) => void;
  onMarkAsReadAction: (id: string) => void;
  autoHideDuration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

const priorityStyles = {
  low: 'border-blue-200 bg-blue-50 text-blue-900',
  normal: 'border-gray-200 bg-white text-gray-900',
  high: 'border-orange-200 bg-orange-50 text-orange-900',
  urgent: 'border-red-200 bg-red-50 text-red-900'
};

const priorityIcons = {
  low: Info,
  normal: Bell,
  high: AlertTriangle,
  urgent: AlertCircle
};

export function ToastNotification({
  notification,
  onDismissAction,
  onMarkAsReadAction,
  autoHideDuration = 5000,
  position = 'top-right'
}: ToastNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  
  // React 19 Enhanced Navigation
  const { navigateToUrl, isNavigating } = useNotificationNavigation();

  const Icon = priorityIcons[notification.priority] || Bell;
  const isUnread = !notification.readAt;

  // React 19 Enhanced: Memoized dismiss handler
  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onDismissAction(notification.id);
    }, 300); // Match animation duration
  }, [onDismissAction, notification.id]);

  const handleClick = () => {
    if (isUnread) {
      onMarkAsReadAction(notification.id);
    }
    
    // Navigate to action URL if provided - React 19 Enhanced
    if (notification.actionUrl) {
      navigateToUrl(notification.actionUrl);
    }
  };

  // Animation entrance
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Auto-hide timer with proper dependency
  useEffect(() => {
    if (autoHideDuration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, autoHideDuration);

      return () => clearTimeout(timer);
    }
  }, [autoHideDuration, handleDismiss]);

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4'
  };

  const animationClasses = {
    'top-right': isVisible && !isExiting ? 'translate-x-0' : 'translate-x-full',
    'top-left': isVisible && !isExiting ? 'translate-x-0' : '-translate-x-full',
    'bottom-right': isVisible && !isExiting ? 'translate-x-0' : 'translate-x-full',
    'bottom-left': isVisible && !isExiting ? 'translate-x-0' : '-translate-x-full'
  };

  return (
    <div
      className={cn(
        'fixed z-50 w-96 max-w-sm transition-all duration-300 ease-in-out',
        positionClasses[position],
        animationClasses[position],
        isExiting && 'opacity-0 scale-95'
      )}
    >
      <div
        className={cn(
          'relative rounded-lg border shadow-lg p-4 cursor-pointer hover:shadow-xl transition-shadow',
          priorityStyles[notification.priority],
          isUnread && 'ring-2 ring-blue-500 ring-opacity-50',
          isNavigating && 'opacity-75' // Visual feedback during navigation
        )}
        onClick={handleClick}
      >
        {/* Unread indicator */}
        {isUnread && (
          <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full"></div>
        )}

        {/* Close button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDismiss();
          }}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-200 transition-colors"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="flex items-start space-x-3 pr-6">
          {/* Icon */}
          <div className="flex-shrink-0 mt-0.5">
            <Icon className="w-5 h-5" />
          </div>

          {/* Text content */}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold truncate">
              {notification.title}
            </h4>
            <p className="text-sm mt-1 line-clamp-2">
              {notification.body}
            </p>
            
            {/* Action button */}
            {notification.actionText && notification.actionUrl && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick();
                }}
                className={cn(
                  "mt-2 text-xs font-medium underline hover:no-underline transition-opacity",
                  isNavigating && "opacity-50"
                )}
                disabled={isNavigating}
              >
                {isNavigating ? 'Loading...' : notification.actionText}
              </button>
            )}

            {/* Timestamp */}
            <div className="text-xs opacity-75 mt-2">
              {new Date(notification.createdAt).toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Progress bar for auto-hide */}
        {autoHideDuration > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 rounded-b-lg overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all ease-linear"
              style={{
                animation: `shrink ${autoHideDuration}ms linear forwards`
              }}
            />
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}

/**
 * Toast Container Component
 * Manages multiple toast notifications
 */
interface ToastContainerProps {
  notifications: Notification[];
  onDismissAction: (id: string) => void;
  onMarkAsReadAction: (id: string) => void;
  maxToasts?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  autoHideDuration?: number;
}

export function ToastContainer({
  notifications,
  onDismissAction,
  onMarkAsReadAction,
  maxToasts = 5,
  position = 'top-right',
  autoHideDuration = 5000
}: ToastContainerProps) {
  // Show only the most recent notifications
  const visibleNotifications = notifications
    .slice(0, maxToasts)
    .reverse(); // Reverse to show newest on top

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {visibleNotifications.map((notification, index) => (
        <div
          key={notification.id}
          className="pointer-events-auto"
          style={{
            zIndex: 50 + index
          }}
        >
          <ToastNotification
            notification={notification}
            onDismissAction={onDismissAction}
            onMarkAsReadAction={onMarkAsReadAction}
            position={position}
            autoHideDuration={autoHideDuration}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Hook for managing toast notifications
 */
export function useToastNotifications() {
  const [toasts, setToasts] = useState<Notification[]>([]);

  const addToast = (notification: Notification) => {
    setToasts(prev => [notification, ...prev]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const clearAllToasts = () => {
    setToasts([]);
  };

  return {
    toasts,
    addToast,
    removeToast,
    clearAllToasts
  };
} 