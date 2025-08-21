/**
 * useNotifications Hook
 * Comprehensive React hook for managing notifications in Ring platform
 * Provides CRUD operations, real-time updates, and state management
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Notification, 
  NotificationListResponse, 
  NotificationStatsResponse,
  NotificationType,
  DetailedNotificationPreferences,
  NotificationStatus
} from '@/features/notifications/types';

interface UseNotificationsOptions {
  limit?: number;
  unreadOnly?: boolean;
  types?: NotificationType[];
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseNotificationsReturn {
  // Data
  notifications: Notification[];
  unreadCount: number;
  totalCount: number;
  hasMore: boolean;
  stats: NotificationStatsResponse | null;
  preferences: DetailedNotificationPreferences | null;
  
  // Loading states
  loading: boolean;
  refreshing: boolean;
  markingAsRead: string | null; // notification ID being marked as read
  markingAllAsRead: boolean;
  updatingPreferences: boolean;
  
  // Error states
  error: string | null;
  
  // Actions
  fetchNotifications: (options?: { reset?: boolean }) => Promise<void>;
  fetchMore: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<boolean>;
  markAllAsRead: () => Promise<boolean>;
  fetchStats: () => Promise<void>;
  fetchPreferences: () => Promise<void>;
  updatePreferences: (preferences: Partial<DetailedNotificationPreferences>) => Promise<boolean>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

export function useNotifications(options: UseNotificationsOptions = {}): UseNotificationsReturn {
  const { data: session } = useSession();
  const {
    limit = 20,
    unreadOnly = false,
    types,
    autoRefresh = false, // Disable auto-refresh by default
    refreshInterval = 600000 // Increased to 10 minutes when enabled (was 5 minutes)
  } = options;

  // State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<string | undefined>();
  const [stats, setStats] = useState<NotificationStatsResponse | null>(null);
  const [preferences, setPreferences] = useState<DetailedNotificationPreferences | null>(null);
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAsRead, setMarkingAsRead] = useState<string | null>(null);
  const [markingAllAsRead, setMarkingAllAsRead] = useState(false);
  const [updatingPreferences, setUpdatingPreferences] = useState(false);
  
  // Error state
  const [error, setError] = useState<string | null>(null);
  
  // Refs
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Helper function to build query params
  const buildQueryParams = useCallback((options: {
    limit?: number;
    startAfter?: string;
    unreadOnly?: boolean;
    types?: NotificationType[];
    stats?: boolean;
  } = {}) => {
    const params = new URLSearchParams();
    
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.startAfter) params.set('startAfter', options.startAfter);
    if (options.unreadOnly) params.set('unreadOnly', 'true');
    if (options.stats) params.set('stats', 'true');
    if (options.types && options.types.length > 0) {
      params.set('types', options.types.join(','));
    }
    
    return params.toString();
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(async (fetchOptions: { reset?: boolean } = {}) => {
    if (!session) return;

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    try {
      const isInitialLoad = fetchOptions.reset || notifications.length === 0;
      
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      
      setError(null);

      const queryParams = buildQueryParams({
        limit,
        startAfter: fetchOptions.reset ? undefined : lastVisible,
        unreadOnly,
        types
      });

      const response = await fetch(`/api/notifications?${queryParams}`, {
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch notifications');
      }

      const data: NotificationListResponse = await response.json();

      if (fetchOptions.reset) {
        setNotifications(data.notifications);
      } else {
        setNotifications(prev => [...prev, ...data.notifications]);
      }
      
      setUnreadCount(data.unreadCount);
      setTotalCount(data.totalCount);
      setHasMore(data.hasMore);
      setLastVisible(data.lastVisible);

    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
        console.error('Error fetching notifications:', err);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session, limit, unreadOnly, types, lastVisible, notifications.length, buildQueryParams]);

  // Fetch more notifications (pagination)
  const fetchMore = useCallback(async () => {
    if (!hasMore || loading || refreshing) return;
    await fetchNotifications({ reset: false });
  }, [hasMore, loading, refreshing, fetchNotifications]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string): Promise<boolean> => {
    if (!session || markingAsRead) return false;

    setMarkingAsRead(notificationId);
    setError(null);

    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to mark notification as read');
      }

      // Update local state optimistically
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, readAt: new Date(), status: NotificationStatus.READ }
            : notification
        )
      );
      
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      return true;

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark notification as read');
      return false;
    } finally {
      setMarkingAsRead(null);
    }
  }, [session, markingAsRead]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async (): Promise<boolean> => {
    if (!session || markingAllAsRead) return false;

    setMarkingAllAsRead(true);
    setError(null);

    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'POST'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to mark all notifications as read');
      }

      const result = await response.json();

      // Update local state optimistically
      setNotifications(prev => 
        prev.map(notification => ({ 
          ...notification, 
          readAt: new Date(), 
          status: NotificationStatus.READ 
        }))
      );
      
      setUnreadCount(0);
      
      return true;

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark all notifications as read');
      return false;
    } finally {
      setMarkingAllAsRead(false);
    }
  }, [session, markingAllAsRead]);

  // Fetch notification stats
  const fetchStats = useCallback(async () => {
    if (!session) return;

    try {
      const queryParams = buildQueryParams({ stats: true });
      const response = await fetch(`/api/notifications?${queryParams}`);

      if (!response.ok) {
        throw new Error('Failed to fetch notification stats');
      }

      const data: NotificationStatsResponse = await response.json();
      setStats(data);

    } catch (err) {
      console.error('Error fetching notification stats:', err);
    }
  }, [session, buildQueryParams]);

  // Fetch user preferences
  const fetchPreferences = useCallback(async () => {
    if (!session) return;

    try {
      const response = await fetch('/api/notifications/preferences');

      if (!response.ok) {
        throw new Error('Failed to fetch notification preferences');
      }

      const data: DetailedNotificationPreferences = await response.json();
      setPreferences(data);

    } catch (err) {
      console.error('Error fetching notification preferences:', err);
    }
  }, [session]);

  // Update user preferences
  const updatePreferences = useCallback(async (
    newPreferences: Partial<DetailedNotificationPreferences>
  ): Promise<boolean> => {
    if (!session || updatingPreferences) return false;

    setUpdatingPreferences(true);
    setError(null);

    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newPreferences)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update preferences');
      }

      // Update local state optimistically
      setPreferences(prev => prev ? { ...prev, ...newPreferences } : null);
      
      return true;

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update preferences');
      return false;
    } finally {
      setUpdatingPreferences(false);
    }
  }, [session, updatingPreferences]);

  // Refresh all data
  const refresh = useCallback(async () => {
    await Promise.all([
      fetchNotifications({ reset: true }),
      fetchStats(),
      fetchPreferences()
    ]);
  }, [fetchNotifications, fetchStats, fetchPreferences]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh || !session) return;

    refreshIntervalRef.current = setInterval(() => {
      fetchNotifications({ reset: true });
    }, refreshInterval);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, session, refreshInterval, fetchNotifications]);

  // Initial data fetch (with debounce to prevent multiple rapid calls)
  useEffect(() => {
    if (session) {
      const timeoutId = setTimeout(() => {
        refresh();
      }, 100); // Small debounce to prevent multiple rapid calls
      
      return () => clearTimeout(timeoutId);
    }
  }, [session?.user?.id]); // Use stable user ID instead of full session object

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  return {
    // Data
    notifications,
    unreadCount,
    totalCount,
    hasMore,
    stats,
    preferences,
    
    // Loading states
    loading,
    refreshing,
    markingAsRead,
    markingAllAsRead,
    updatingPreferences,
    
    // Error state
    error,
    
    // Actions
    fetchNotifications,
    fetchMore,
    markAsRead,
    markAllAsRead,
    fetchStats,
    fetchPreferences,
    updatePreferences,
    refresh,
    clearError
  };
} 