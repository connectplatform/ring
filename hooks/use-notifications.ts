/**
 * useNotifications Hook
 * Comprehensive React hook for managing notifications in Ring platform
 * Provides CRUD operations, real-time updates, and state management
 */

import { useState, useEffect, useCallback, useRef, use, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { apiClient, ApiClientError, type ApiResponse } from '@/lib/api-client';
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

  // Fetch notifications with Ring API Client
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

      // Use API client with built-in timeout and retry logic
      const response: ApiResponse<NotificationListResponse> = await apiClient.get(`/api/notifications?${queryParams}`, {
        timeout: 8000, // 8 second timeout for list operations
        retries: 1, // Retry once for transient failures
        headers: {
          ...apiClient['defaultHeaders'], // Access default headers
          // Note: AbortController signal needs custom handling with API client
          // We'll let the API client handle timeouts, but still track abort for user cancellation
        }
      });

      // Check if request was aborted by user
      if (abortControllerRef.current?.signal.aborted) {
        return; // Exit silently for user-initiated cancellation
      }

      if (response.success && response.data) {
        const data = response.data;

        if (fetchOptions.reset) {
          setNotifications(data.notifications);
        } else {
          setNotifications(prev => [...prev, ...data.notifications]);
        }
        
        setUnreadCount(data.unreadCount);
        setTotalCount(data.totalCount);
        setHasMore(data.hasMore);
        setLastVisible(data.lastVisible);
      } else {
        throw new Error(response.error || 'Failed to fetch notifications');
      }

    } catch (err) {
      // Check if request was aborted by user before setting error
      if (abortControllerRef.current?.signal.aborted) {
        return; // Exit silently for user-initiated cancellation
      }

      if (err instanceof ApiClientError) {
        setError(err.message);
        console.error('Notifications fetch failed:', {
          endpoint: '/api/notifications',
          statusCode: err.statusCode,
          message: err.message,
          context: err.context,
          cause: err.cause
        });
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch notifications';
        setError(errorMessage);
        console.error('Unexpected error fetching notifications:', err);
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

  // Mark notification as read with Ring API Client
  const markAsRead = useCallback(async (notificationId: string): Promise<boolean> => {
    if (!session || markingAsRead) return false;

    setMarkingAsRead(notificationId);
    setError(null);

    try {
      const response: ApiResponse = await apiClient.post(`/api/notifications/${notificationId}/read`, undefined, {
        timeout: 5000, // 5 second timeout for quick actions
        retries: 1 // Retry once for network issues
      });

      if (response.success) {
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
      } else {
        throw new Error(response.error || 'Failed to mark notification as read');
      }

    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        console.error('Mark as read failed:', {
          endpoint: `/api/notifications/${notificationId}/read`,
          statusCode: err.statusCode,
          notificationId,
          context: err.context
        });
      } else {
        setError(err instanceof Error ? err.message : 'Failed to mark notification as read');
        console.error('Unexpected error marking notification as read:', err);
      }
      return false;
    } finally {
      setMarkingAsRead(null);
    }
  }, [session, markingAsRead]);

  // Mark all notifications as read with Ring API Client
  const markAllAsRead = useCallback(async (): Promise<boolean> => {
    if (!session || markingAllAsRead) return false;

    setMarkingAllAsRead(true);
    setError(null);

    try {
      const response: ApiResponse = await apiClient.post('/api/notifications/read-all', undefined, {
        timeout: 10000, // 10 second timeout for bulk operations
        retries: 2 // Retry twice for bulk operations
      });

      if (response.success) {
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
      } else {
        throw new Error(response.error || 'Failed to mark all notifications as read');
      }

    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        console.error('Mark all as read failed:', {
          endpoint: '/api/notifications/read-all',
          statusCode: err.statusCode,
          context: err.context
        });
      } else {
        setError(err instanceof Error ? err.message : 'Failed to mark all notifications as read');
        console.error('Unexpected error marking all notifications as read:', err);
      }
      return false;
    } finally {
      setMarkingAllAsRead(false);
    }
  }, [session, markingAllAsRead]);

  // Fetch notification stats with Ring API Client
  const fetchStats = useCallback(async () => {
    if (!session) return;

    try {
      const queryParams = buildQueryParams({ stats: true });
      const response: ApiResponse<NotificationStatsResponse> = await apiClient.get(`/api/notifications?${queryParams}`, {
        timeout: 6000, // 6 second timeout for stats
        retries: 1 // Retry once for stats
      });

      if (response.success && response.data) {
        setStats(response.data);
      } else {
        throw new Error(response.error || 'Failed to fetch notification stats');
      }

    } catch (err) {
      if (err instanceof ApiClientError) {
        console.error('Notification stats fetch failed:', {
          endpoint: '/api/notifications (stats)',
          statusCode: err.statusCode,
          context: err.context
        });
      } else {
        console.error('Unexpected error fetching notification stats:', err);
      }
    }
  }, [session, buildQueryParams]);

  // Fetch user preferences with Ring API Client
  const fetchPreferences = useCallback(async () => {
    if (!session) return;

    try {
      const response: ApiResponse<DetailedNotificationPreferences> = await apiClient.get('/api/notifications/preferences', {
        timeout: 5000, // 5 second timeout for preferences
        retries: 1 // Retry once for preferences
      });

      if (response.success && response.data) {
        setPreferences(response.data);
      } else {
        throw new Error(response.error || 'Failed to fetch notification preferences');
      }

    } catch (err) {
      if (err instanceof ApiClientError) {
        console.error('Notification preferences fetch failed:', {
          endpoint: '/api/notifications/preferences',
          statusCode: err.statusCode,
          context: err.context
        });
      } else {
        console.error('Unexpected error fetching notification preferences:', err);
      }
    }
  }, [session]);

  // Update user preferences with Ring API Client
  const updatePreferences = useCallback(async (
    newPreferences: Partial<DetailedNotificationPreferences>
  ): Promise<boolean> => {
    if (!session || updatingPreferences) return false;

    setUpdatingPreferences(true);
    setError(null);

    try {
      const response: ApiResponse = await apiClient.put('/api/notifications/preferences', newPreferences, {
        timeout: 8000, // 8 second timeout for preference updates
        retries: 2 // Retry twice for important preference updates
      });

      if (response.success) {
        // Update local state optimistically
        setPreferences(prev => prev ? { ...prev, ...newPreferences } : null);
        
        return true;
      } else {
        throw new Error(response.error || 'Failed to update preferences');
      }

    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        console.error('Notification preferences update failed:', {
          endpoint: '/api/notifications/preferences',
          statusCode: err.statusCode,
          context: err.context,
          preferences: newPreferences
        });
      } else {
        setError(err instanceof Error ? err.message : 'Failed to update preferences');
        console.error('Unexpected error updating notification preferences:', err);
      }
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

/**
 * Internal function to fetch notifications
 * Enhanced with timeout, retry, and standardized error handling
 */
async function fetchNotificationsData(options: UseNotificationsOptions = {}): Promise<NotificationListResponse> {
  const {
    limit = 20,
    unreadOnly = false,
    types
  } = options;

  const params = new URLSearchParams();
  params.set('limit', limit.toString());
  if (unreadOnly) params.set('unreadOnly', 'true');
  if (types && types.length > 0) {
    params.set('types', types.join(','));
  }

  // Use API client with notification domain configuration (10s timeout, 2 retries)
  const response: ApiResponse<NotificationListResponse> = await apiClient.get(
    `/api/notifications?${params}`,
    {
      timeout: 10000, // 10 second timeout for notifications
      retries: 2 // Retry twice for network resilience
    }
  );

  if (response.success && response.data) {
    return response.data;
  } else {
    throw new Error(response.error || 'Failed to fetch notifications');
  }
}

/**
 * React 19 Promise-based hook for notifications using use() function
 * Returns a promise that can be consumed with React 19's use() function
 * 
 * Usage:
 * ```tsx
 * function NotificationsList() {
 *   const notificationsPromise = useNotificationsPromise({ limit: 10, unreadOnly: true })
 *   const notificationsData = use(notificationsPromise)
 *   
 *   return (
 *     <div>
 *       {notificationsData.notifications.map(notif => (
 *         <div key={notif.id}>{notif.title}</div>
 *       ))}
 *     </div>
 *   )
 * }
 * 
 * // Wrap in Suspense boundary
 * function App() {
 *   return (
 *     <Suspense fallback={<div>Loading notifications...</div>}>
 *       <NotificationsList />
 *     </Suspense>
 *   )
 * }
 * ```
 */
export function useNotificationsPromise(options: UseNotificationsOptions = {}): Promise<NotificationListResponse> {
  return useMemo(() => {
    return fetchNotificationsData(options)
  }, [options])
}

/**
 * React 19 Enhanced hook that directly uses use() function for notifications
 * Suspends the component until the notifications are loaded
 */
export function useNotificationsWithSuspense(options: UseNotificationsOptions = {}): NotificationListResponse {
  const promise = useNotificationsPromise(options)
  return use(promise)
} 