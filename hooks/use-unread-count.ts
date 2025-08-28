/**
 * useUnreadCount Hook
 * Optimized hook for fetching and caching unread notification count
 * Features: sessionStorage caching, tab visibility detection, optimized polling
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface UseUnreadCountOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  cacheTimeout?: number; // Cache TTL in milliseconds
}

interface UseUnreadCountReturn {
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  clearError: () => void;
}

export function useUnreadCount(options: UseUnreadCountOptions = {}): UseUnreadCountReturn {
  const { data: session } = useSession();
  const {
    autoRefresh = true,
    refreshInterval = 180000, // 3 minutes
    cacheTimeout = 120000 // 2 minutes cache TTL
  } = options;

  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simple fetch function with built-in debouncing and caching
  const fetchUnreadCount = useCallback(async () => {
    if (!session) return;

    try {
      setError(null);
      
      // Add cache-busting only when needed, not on every request
      const cacheKey = 'notifications-unread';
      const cached = sessionStorage.getItem(cacheKey);
      const cacheTime = sessionStorage.getItem(`${cacheKey}-time`);
      const now = Date.now();

      // Use cache if less than cacheTimeout old
      if (cached && cacheTime && (now - parseInt(cacheTime)) < cacheTimeout) {
        const data = JSON.parse(cached);
        setUnreadCount(data.unreadCount || 0);
        return;
      }

      setLoading(true);

      const response = await fetch('/api/notifications?unreadOnly=true&limit=1&stats=true');
      
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.unreadCount || 0);
        
        // Cache the result
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
        sessionStorage.setItem(`${cacheKey}-time`, now.toString());
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch unread count';
      setError(errorMessage);
      console.error('Failed to fetch unread count:', error);
    } finally {
      setLoading(false);
    }
  }, [session, cacheTimeout]);

  // Refresh function for manual refresh
  const refresh = useCallback(async () => {
    // Clear cache and fetch immediately
    sessionStorage.removeItem('notifications-unread');
    sessionStorage.removeItem('notifications-unread-time');
    await fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initial fetch
  useEffect(() => {
    if (session) {
      fetchUnreadCount();
    }
  }, [session, fetchUnreadCount]);

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh || !session) return;

    const interval = setInterval(fetchUnreadCount, refreshInterval);

    return () => {
      clearInterval(interval);
    };
  }, [autoRefresh, session, refreshInterval, fetchUnreadCount]);

  // Listen for tab visibility changes to refresh when tab becomes active
  useEffect(() => {
    if (!session) return;

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Clear cache when tab becomes active and fetch immediately
        sessionStorage.removeItem('notifications-unread');
        sessionStorage.removeItem('notifications-unread-time');
        fetchUnreadCount();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session, fetchUnreadCount]);

  return {
    unreadCount,
    loading,
    error,
    refresh,
    clearError
  };
}
