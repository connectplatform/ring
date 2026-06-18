/**
 * useUnreadCount Hook
 * Uses the shared useSync primitive for fetch + polling + tunnel sync.
 */

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import type { TunnelMessage } from '@/lib/tunnel/types'
import { useSync } from './use-sync'

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
  const { data: session } = useSession()

  const {
    autoRefresh = true,
    refreshInterval = 180000, // 3 minutes
    cacheTimeout = 120000, // 2 minutes cache TTL
    enableTunnel = true // PHASE 1: Enable tunnel by default
  } = options

  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null)

  const fetchUnreadCount = useCallback(async () => {
    if (!session) {
      return 0
    }

    try {
      const response = await fetch('/api/notifications?unreadOnly=true&limit=1&stats=true')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return data?.unreadCount ?? 0
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch unread count'
      const isAuthTransition = sessionStartTime ? Date.now() - sessionStartTime < 5000 : false
      const isAuthError = errorMessage.includes('401') || errorMessage.includes('500')

      if (isAuthTransition && isAuthError) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        return fetchUnreadCount()
      }

      throw new Error(errorMessage)
    }
  }, [session, sessionStartTime])

  const handleTunnelMessage = useCallback((message: TunnelMessage) => {
    const nextCount = message?.payload?.unreadCount
    if (nextCount == null) {
      return { shouldRefetch: true }
    }
    const parsed = typeof nextCount === 'number' ? nextCount : Number(nextCount)
    if (!Number.isFinite(parsed)) {
      return { shouldRefetch: true }
    }
    return { nextData: parsed }
  }, [])

  const sync = useSync<number>({
    enabled: Boolean(session),
    autoRefresh,
    refreshInterval,
    cache: {
      key: 'notifications-unread',
      ttlMs: cacheTimeout
    },
    fetcher: fetchUnreadCount,
    tunnel: {
      channel: 'notifications:unread',
      enabled: enableTunnel,
      onMessage: handleTunnelMessage,
    }
  })

  useEffect(() => {
    if (session && !sessionStartTime) {
      setSessionStartTime(Date.now())
    } else if (!session && sessionStartTime) {
      setSessionStartTime(null)
    }
  }, [session, sessionStartTime])

  const refresh = useCallback(async () => {
    sync.clearCache()
    await sync.refresh()
  }, [sync])

  const clearError = useCallback(() => {
    sync.clearError()
  }, [sync])

  return {
    unreadCount: sync.data ?? 0,
    loading: sync.loading,
    error: sync.error,
    refresh,
    clearError
  }
}
