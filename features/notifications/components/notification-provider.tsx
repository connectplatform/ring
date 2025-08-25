/**
 * Notification Provider Component
 * Global provider for managing notification state and toast notifications
 */

'use client';

import React, { createContext, useContext, useCallback, useEffect, useState, use } from 'react';
import { useSession } from 'next-auth/react';
import { Notification } from '@/features/notifications/types';
import { ToastContainer, useToastNotifications } from './toast-notification';
import { NotificationType, NotificationPriority, NotificationStatus, NotificationChannel, NotificationTrigger } from '@/features/notifications/types';

interface NotificationContextType {
  // Toast management
  showToast: (notification: Notification) => void;
  hideToast: (id: string) => void;
  clearAllToasts: () => void;
  
  // Global notification state
  unreadCount: number;
  hasNewNotifications: boolean;
  markAsRead: (id: string) => void;
  
  // Settings
  toastPosition: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  setToastPosition: (position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left') => void;
  toastDuration: number;
  setToastDuration: (duration: number) => void;
  maxToasts: number;
  setMaxToasts: (max: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: React.ReactNode;
  defaultPosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  defaultDuration?: number;
  defaultMaxToasts?: number;
}

export function NotificationProvider({
  children,
  defaultPosition = 'top-right',
  defaultDuration = 5000,
  defaultMaxToasts = 5
}: NotificationProviderProps) {
  const { data: session } = useSession();
  const { toasts, addToast, removeToast, clearAllToasts } = useToastNotifications();
  
  // Settings state
  const [toastPosition, setToastPosition] = useState(defaultPosition);
  const [toastDuration, setToastDuration] = useState(defaultDuration);
  const [maxToasts, setMaxToasts] = useState(defaultMaxToasts);
  
  // Global notification state
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [lastNotificationCheck, setLastNotificationCheck] = useState<Date>(new Date());

  // Show toast notification
  const showToast = useCallback((notification: Notification) => {
    addToast(notification);
    
    // Mark as new notification
    setHasNewNotifications(true);
    
    // Auto-clear the "new" flag after a delay
    setTimeout(() => {
      setHasNewNotifications(false);
    }, 10000);
  }, [addToast]);

  // Hide specific toast
  const hideToast = useCallback((id: string) => {
    removeToast(id);
  }, [removeToast]);

  // Mark notification as read
  const markAsRead = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'POST'
      });

      if (response.ok) {
        setUnreadCount(prev => Math.max(0, prev - 1));
        
        // Remove from toasts if present
        removeToast(id);
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, [removeToast]);

  // DEPRECATED: Old polling code - disabled in favor of WebSocket push
  // WebSocket now handles real-time notification updates
  useEffect(() => {
    // Polling disabled - using WebSocket push notifications
    // The unreadCount is now updated via WebSocketProvider
    console.log('Notification polling disabled - using WebSocket push');
  }, [session]);

  // Listen for new notifications via Server-Sent Events (when implemented)
  useEffect(() => {
    if (!session) return;

    // TODO: Implement SSE connection for real-time notifications
    // const eventSource = new EventSource('/api/notifications/stream');
    
    // eventSource.onmessage = (event) => {
    //   const notification = JSON.parse(event.data);
    //   showToast(notification);
    //   setUnreadCount(prev => prev + 1);
    // };

    // return () => {
    //   eventSource.close();
    // };
  }, [session, showToast]);

  // Load settings from localStorage
  useEffect(() => {
    const savedPosition = localStorage.getItem('notification-toast-position');
    const savedDuration = localStorage.getItem('notification-toast-duration');
    const savedMaxToasts = localStorage.getItem('notification-max-toasts');

    if (savedPosition) {
      setToastPosition(savedPosition as any);
    }
    if (savedDuration) {
      setToastDuration(parseInt(savedDuration));
    }
    if (savedMaxToasts) {
      setMaxToasts(parseInt(savedMaxToasts));
    }
  }, []);

  // Save settings to localStorage
  const handleSetToastPosition = useCallback((position: typeof toastPosition) => {
    setToastPosition(position);
    localStorage.setItem('notification-toast-position', position);
  }, []);

  const handleSetToastDuration = useCallback((duration: number) => {
    setToastDuration(duration);
    localStorage.setItem('notification-toast-duration', duration.toString());
  }, []);

  const handleSetMaxToasts = useCallback((max: number) => {
    setMaxToasts(max);
    localStorage.setItem('notification-max-toasts', max.toString());
  }, []);

  const contextValue: NotificationContextType = {
    // Toast management
    showToast,
    hideToast,
    clearAllToasts,
    
    // Global notification state
    unreadCount,
    hasNewNotifications,
    markAsRead,
    
    // Settings
    toastPosition,
    setToastPosition: handleSetToastPosition,
    toastDuration,
    setToastDuration: handleSetToastDuration,
    maxToasts,
    setMaxToasts: handleSetMaxToasts
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      
      {/* Toast Container */}
      <ToastContainer
        notifications={toasts}
        onDismissAction={hideToast}
        onMarkAsReadAction={markAsRead}
        position={toastPosition}
        maxToasts={maxToasts}
        autoHideDuration={toastDuration}
      />
    </NotificationContext.Provider>
  );
}

/**
 * Hook to use notification context
 */
export function useNotificationContext() {
  const context = use(NotificationContext);
  
  if (context === undefined) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  
  return context;
}

/**
 * Hook for showing toast notifications easily
 */
export function useToast() {
  const { showToast } = useNotificationContext();
  
  const toast = useCallback((notification: Partial<Notification> & { title: string; body: string }) => {
    const fullNotification: Notification = {
      id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: '',
      type: notification.type || NotificationType.SYSTEM_UPDATE,
      title: notification.title,
      body: notification.body,
      priority: notification.priority || NotificationPriority.NORMAL,
      status: NotificationStatus.DELIVERED,
      trigger: NotificationTrigger.USER_ACTION,
      channels: [NotificationChannel.IN_APP],
      deliveries: [],
      data: {},
      createdAt: new Date(),
      actionText: notification.actionText,
      actionUrl: notification.actionUrl
    };
    
    showToast(fullNotification);
  }, [showToast]);

  return { toast };
}

/**
 * Utility functions for common toast types
 */
export function useToastHelpers() {
  const { toast } = useToast();

  const success = useCallback((title: string, body: string, actionUrl?: string) => {
    toast({
      title,
      body,
      priority: NotificationPriority.NORMAL,
      actionUrl,
      actionText: actionUrl ? 'View' : undefined
    });
  }, [toast]);

  const error = useCallback((title: string, body: string, actionUrl?: string) => {
    toast({
      title,
      body,
      priority: NotificationPriority.URGENT,
      actionUrl,
      actionText: actionUrl ? 'View Details' : undefined
    });
  }, [toast]);

  const info = useCallback((title: string, body: string, actionUrl?: string) => {
    toast({
      title,
      body,
      priority: NotificationPriority.LOW,
      actionUrl,
      actionText: actionUrl ? 'Learn More' : undefined
    });
  }, [toast]);

  const warning = useCallback((title: string, body: string, actionUrl?: string) => {
    toast({
      title,
      body,
      priority: NotificationPriority.HIGH,
      actionUrl,
      actionText: actionUrl ? 'Take Action' : undefined
    });
  }, [toast]);

  return { success, error, info, warning };
} 