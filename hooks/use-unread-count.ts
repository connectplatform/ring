/**
 * useUnreadCount Hook
 * PHASE 1: Server push enabled - uses tunnel for real-time updates when available
 * Falls back to optimized polling when tunnel is not ready
 * Features: sessionStorage caching, tab visibility detection, server push vs polling
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useTunnel } from './use-tunnel';

interface UseUnreadCountOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  cacheTimeout?: number; // Cache TTL in milliseconds
  enableTunnel?: boolean; // PHASE 1: Enable tunnel-based server push
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
    cacheTimeout = 120000, // 2 minutes cache TTL
    enableTunnel = true // PHASE 1: Enable tunnel by default
  } = options;

  // PHASE 1: Tunnel integration for server push
  const { isConnected: tunnelConnected, subscribe, connectionState } = useTunnel();

  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingTunnel, setUsingTunnel] = useState(false);
  // Track session availability time to handle auth transition gracefully
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

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
      
      // Auth Transition Grace Period: During first 5 seconds after session appears,
      // suppress 401/500 errors as these are likely race conditions during OAuth redirect
      const isAuthTransition = sessionStartTime && (Date.now() - sessionStartTime) < 5000;
      const isAuthError = errorMessage.includes('401') || errorMessage.includes('500');
      
      if (isAuthTransition && isAuthError) {
        console.log('useUnreadCount: Suppressing error during auth transition:', errorMessage);
        // Silent retry after short delay
        setTimeout(() => fetchUnreadCount(), 1000);
      } else {
        setError(errorMessage);
        console.error('Failed to fetch unread count:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [session, cacheTimeout, sessionStartTime]);

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

  // PHASE 1: Tunnel subscription for server push
  useEffect(() => {
    if (!session || !enableTunnel) return;

    let unsubscribe: (() => void) | null = null;

    // Set up tunnel subscription when tunnel is connected
    if (tunnelConnected) {
      try {
        console.log('useUnreadCount: Setting up tunnel subscription for notifications');
        unsubscribe = subscribe('notifications:unread', (message: any) => {
          console.log('useUnreadCount: Received unread count update via tunnel:', message);
          const newCount = message?.payload?.unreadCount || 0;
          setUnreadCount(newCount);
          setUsingTunnel(true);
          setError(null);

          // Update cache when receiving tunnel updates
          const cacheKey = 'notifications-unread';
          const cacheData = { unreadCount: newCount };
          sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
          sessionStorage.setItem(`${cacheKey}-time`, Date.now().toString());
        });

        setUsingTunnel(true);
        console.log('useUnreadCount: Tunnel subscription established');
      } catch (error) {
        console.error('useUnreadCount: Failed to subscribe to tunnel:', error);
        setUsingTunnel(false);
      }
    } else {
      setUsingTunnel(false);
    }

    // Cleanup subscription on unmount or when tunnel disconnects
    return () => {
      if (unsubscribe) {
        unsubscribe();
        console.log('useUnreadCount: Tunnel subscription cleaned up');
      }
    };
  }, [session, tunnelConnected, subscribe, enableTunnel]);

  // Track when session becomes available (for auth transition grace period)
  useEffect(() => {
    if (session && !sessionStartTime) {
      setSessionStartTime(Date.now());
    } else if (!session && sessionStartTime) {
      setSessionStartTime(null);
    }
  }, [session, sessionStartTime]);

  // Initial fetch
  useEffect(() => {
    if (session) {
      fetchUnreadCount();
    }
  }, [session, fetchUnreadCount]);

  // PHASE 1: Auto-refresh setup - only poll when tunnel is not available
  useEffect(() => {
    if (!autoRefresh || !session) return;

    // Skip polling if tunnel is connected and working
    if (usingTunnel && tunnelConnected) {
      console.log('useUnreadCount: Skipping polling - using tunnel for real-time updates');
      return;
    }

    console.log('useUnreadCount: Using polling for updates (tunnel not available)');
    const interval = setInterval(fetchUnreadCount, refreshInterval);

    return () => {
      clearInterval(interval);
    };
  }, [autoRefresh, session, refreshInterval, fetchUnreadCount, usingTunnel, tunnelConnected]);

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
