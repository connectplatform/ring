/**
 * Generic resource sync hook.
 * Handles polling + tunnel-driven refresh with optional sessionStorage caching
 * and document visibility refresh.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTunnel } from './use-tunnel'
import { TunnelMessage } from '@/lib/tunnel/types'

interface UseSyncCacheOptions {
  key?: string
  ttlMs?: number
}

export interface UseSyncTunnelAction<T> {
  nextData?: T
  shouldRefetch?: boolean
}

export interface UseSyncTunnelOptions<T> {
  channel?: string
  enabled?: boolean
  onMessage?: (
    message: TunnelMessage,
    context: { data: T | null }
  ) => UseSyncTunnelAction<T> | void
}

export interface UseSyncOptions<T> {
  enabled?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
  visibilityRefresh?: boolean
  cache?: UseSyncCacheOptions
  fetcher: () => Promise<T>
  onData?: (data: T) => void
  onError?: (error: Error) => void
  initialData?: T | null
  initialError?: string | null
  tunnel?: UseSyncTunnelOptions<T>
}

export interface UseSyncReturn<T> {
  data: T | null
  loading: boolean
  error: string | null
  usingTunnel: boolean
  tunnelConnected: boolean
  refresh: () => Promise<T | null>
  clearCache: () => void
  clearError: () => void
}

export function useSync<T>(options: UseSyncOptions<T>): UseSyncReturn<T> {
  const {
    enabled = true,
    autoRefresh = true,
    refreshInterval = 180000,
    visibilityRefresh = true,
    cache,
    fetcher,
    onData,
    onError,
    initialData = null,
    initialError = null,
    tunnel
  } = options

  const { isConnected: tunnelConnected, subscribe } = useTunnel()
  const tunnelChannel = tunnel?.channel
  const tunnelEnabled = tunnel?.enabled ?? false

  const [data, setData] = useState<T | null>(initialData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [usingTunnel, setUsingTunnel] = useState(false)

  const dataRef = useRef<T | null>(initialData)
  const enabledRef = useRef(enabled)
  const fetcherRef = useRef(fetcher)
  const onDataRef = useRef(onData)
  const onErrorRef = useRef(onError)
  const tunnelOnMessageRef = useRef(tunnel?.onMessage)
  const cacheRef = useRef(cache)
  const inFlightRef = useRef(false)
  const visibilityRef = useRef(visibilityRefresh)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  enabledRef.current = enabled
  fetcherRef.current = fetcher
  onDataRef.current = onData
  onErrorRef.current = onError
  tunnelOnMessageRef.current = tunnel?.onMessage
  cacheRef.current = cache
  visibilityRef.current = visibilityRefresh
  dataRef.current = data

  const clearCache = useCallback(() => {
    if (!cacheRef.current?.key || typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
      return
    }
    const cacheKey = cacheRef.current.key
    sessionStorage.removeItem(cacheKey)
    sessionStorage.removeItem(`${cacheKey}-time`)
  }, [])

  const getCached = useCallback((): T | null => {
    if (!cacheRef.current?.key || typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
      return null
    }
    try {
      const cacheKey = cacheRef.current.key
      const cached = sessionStorage.getItem(cacheKey)
      const cacheTime = sessionStorage.getItem(`${cacheKey}-time`)
      if (!cached || !cacheTime) {
        return null
      }
      const ttl = cacheRef.current.ttlMs ?? 120000
      if (Date.now() - Number(cacheTime) > ttl) {
        sessionStorage.removeItem(cacheKey)
        sessionStorage.removeItem(`${cacheKey}-time`)
        return null
      }
      return JSON.parse(cached) as T
    } catch {
      return null
    }
  }, [])

  const setCached = useCallback((value: T) => {
    if (!cacheRef.current?.key || typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
      return
    }
    try {
      const cacheKey = cacheRef.current.key
      sessionStorage.setItem(cacheKey, JSON.stringify(value))
      sessionStorage.setItem(`${cacheKey}-time`, Date.now().toString())
    } catch {
      // Ignore cache failures
    }
  }, [])

  const applyData = useCallback((nextData: T) => {
    setData(nextData)
    dataRef.current = nextData
    onDataRef.current?.(nextData)
    setCached(nextData)
  }, [setCached])

  const refresh = useCallback(async () => {
    if (!enabledRef.current || inFlightRef.current) {
      return dataRef.current
    }
    inFlightRef.current = true
    setLoading(true)
    setError(null)

    try {
      const cached = getCached()
      if (cached !== null) {
        applyData(cached)
        return cached
      }

      const nextData = await fetcherRef.current()
      applyData(nextData)
      return nextData
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch resource'
      setError(errorMessage)
      onErrorRef.current?.(err instanceof Error ? err : new Error(errorMessage))
      return dataRef.current
    } finally {
      setLoading(false)
      inFlightRef.current = false
    }
  }, [applyData, getCached])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  useEffect(() => {
    if (!enabled || !tunnelChannel || !tunnelEnabled) {
      setUsingTunnel((prev) => (prev ? false : prev))
      return
    }

    if (!tunnelConnected) {
      setUsingTunnel((prev) => (prev ? false : prev))
      return
    }

    let unsubscribe: (() => void) | null = null
    try {
      unsubscribe = subscribe(tunnelChannel, async (message: TunnelMessage) => {
        const action = tunnelOnMessageRef.current?.(message, { data: dataRef.current })
        if (!action) {
          return
        }

        if (action.nextData !== undefined) {
          applyData(action.nextData)
          setError(null)
          return
        }

        if (action.shouldRefetch) {
          void refresh()
        }
      })
      setUsingTunnel((prev) => (prev ? prev : true))
    } catch (err) {
      setUsingTunnel((prev) => (prev ? false : prev))
      onErrorRef.current?.(err instanceof Error ? err : new Error('Failed to subscribe to tunnel updates'))
      setError('Failed to subscribe to tunnel updates')
    }

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
      setUsingTunnel((prev) => (prev ? false : prev))
    }
  }, [enabled, tunnelChannel, tunnelEnabled, tunnelConnected, subscribe, refresh, applyData])

  useEffect(() => {
    if (!enabled) {
      return
    }

    void refresh()
  }, [enabled, refresh])

  useEffect(() => {
    if (!enabled || !autoRefresh || refreshInterval <= 0) {
      return
    }

    if (usingTunnel && tunnelConnected) {
      return
    }

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    timerRef.current = setInterval(() => {
      void refresh()
    }, refreshInterval)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [enabled, autoRefresh, refreshInterval, usingTunnel, tunnelConnected, refresh])

  useEffect(() => {
    if (!enabled || !visibilityRef.current || typeof document === 'undefined') {
      return
    }

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        clearCache()
        void refresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled, clearCache, refresh])

  return {
    data,
    loading,
    error,
    usingTunnel,
    tunnelConnected,
    refresh,
    clearCache,
    clearError
  }
}
