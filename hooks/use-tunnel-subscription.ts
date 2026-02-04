'use client'

/**
 * Tunnel Subscription Hook
 * Provides real-time data updates via Tunnel protocol instead of polling
 * 
 * FIXED: Eliminated subscribe/unsubscribe loops by:
 * - Using refs for stable callbacks
 * - Single connection per session
 * - Proper cleanup on unmount only
 * 
 * @see AI-CONTEXT: tunnel-protocol-firebase-rtdb-analog-2025-11-07
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { logger } from '@/lib/logger'
import { TunnelConnectionState, TunnelMessage } from '@/lib/tunnel/types'

// Client-side tunnel manager singleton
let clientTunnelManager: any = null
let connectionPromise: Promise<any> | null = null
let isConnecting = false

// Track active subscriptions to prevent duplicates
const activeSubscriptions = new Set<string>()

interface UseTunnelSubscriptionOptions<T> {
  channel: string
  onMessage?: (data: T) => void
  enabled?: boolean
}

interface UseTunnelSubscriptionReturn<T> {
  data: T | null
  isConnected: boolean
  connectionState: TunnelConnectionState
  error: string | null
  reconnect: () => void
}

/**
 * Initialize client-side tunnel connection
 * Uses singleton pattern to avoid multiple connections
 */
async function getClientTunnelManager() {
  // Return existing manager if available
  if (clientTunnelManager) {
    return clientTunnelManager
  }

  // Wait for existing connection attempt
  if (connectionPromise) {
    return connectionPromise
  }

  // Prevent multiple simultaneous connection attempts
  if (isConnecting) {
    // Wait a bit and try again
    await new Promise(resolve => setTimeout(resolve, 100))
    return getClientTunnelManager()
  }

  isConnecting = true

  connectionPromise = (async () => {
    try {
      // Dynamic import to avoid SSR issues
      const { getTunnelTransportManager } = await import('@/lib/tunnel/transport-manager')
      
      const manager = getTunnelTransportManager({
        debug: process.env.NODE_ENV === 'development'
      })

      // Connect to tunnel
      await manager.connect()
      
      clientTunnelManager = manager
      logger.info('Tunnel client connected successfully')
      
      return manager
    } catch (error) {
      logger.error('Failed to initialize tunnel client:', error)
      connectionPromise = null
      throw error
    } finally {
      isConnecting = false
    }
  })()

  return connectionPromise
}

/**
 * Hook for subscribing to tunnel channels
 * Replaces polling with real-time push updates
 * 
 * OPTIMIZED: Uses refs to prevent re-subscription loops
 */
export function useTunnelSubscription<T = any>(
  options: UseTunnelSubscriptionOptions<T>
): UseTunnelSubscriptionReturn<T> {
  const { channel, onMessage, enabled = true } = options
  const { data: session, status } = useSession()
  
  const [data, setData] = useState<T | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionState, setConnectionState] = useState<TunnelConnectionState>(
    TunnelConnectionState.DISCONNECTED
  )
  const [error, setError] = useState<string | null>(null)
  
  // Use refs to store mutable values without causing re-renders
  const subscriptionRef = useRef<any>(null)
  const managerRef = useRef<any>(null)
  const onMessageRef = useRef(onMessage)
  const hasSubscribedRef = useRef(false)
  const userIdRef = useRef<string | null>(null)

  // Update onMessage ref when it changes (without triggering re-subscription)
  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  // Single effect for connection and subscription management
  useEffect(() => {
    // Skip if not authenticated or not enabled
    if (status !== 'authenticated' || !session?.user?.id || !enabled) {
      return
    }

    const userId = session.user.id
    const userChannel = `${channel}:${userId}`

    // Skip if already subscribed to this channel
    if (hasSubscribedRef.current && userIdRef.current === userId) {
      return
    }

    // Skip if subscription already active globally
    if (activeSubscriptions.has(userChannel)) {
      logger.debug('Subscription already active, skipping:', { userChannel })
      return
    }

    let mounted = true

    const setupSubscription = async () => {
      try {
        setConnectionState(TunnelConnectionState.CONNECTING)
        setError(null)

        const manager = await getClientTunnelManager()
        
        if (!mounted) return

        managerRef.current = manager
        userIdRef.current = userId

        // Mark subscription as active
        activeSubscriptions.add(userChannel)
        hasSubscribedRef.current = true

        // Set up event handlers only once
        const handleConnect = () => {
          if (mounted) {
            setIsConnected(true)
            setConnectionState(TunnelConnectionState.CONNECTED)
          }
        }

        const handleDisconnect = () => {
          if (mounted) {
            setIsConnected(false)
            setConnectionState(TunnelConnectionState.DISCONNECTED)
          }
        }

        const handleMessage = (message: TunnelMessage) => {
          if (!mounted) return
          if (message.channel === userChannel || message.metadata?.userId === userId) {
            if (message.payload) {
              setData(message.payload as T)
              onMessageRef.current?.(message.payload as T)
              logger.debug('Tunnel message received:', { channel: userChannel })
            }
          }
        }

        // Register event handlers
        manager.on('connect', handleConnect)
        manager.on('disconnect', handleDisconnect)
        manager.on('message', handleMessage)
        manager.on('notification', handleMessage)

        // Subscribe to channel
        const subscription = await manager.subscribe({
          channel: userChannel,
          events: ['balance:update', 'credit:update', 'data'],
          metadata: { userId }
        })

        if (!mounted) {
          // Cleanup if unmounted during async operation
          await manager.unsubscribe(subscription.id).catch(() => {})
          activeSubscriptions.delete(userChannel)
          return
        }

        subscriptionRef.current = subscription
        setIsConnected(true)
        setConnectionState(TunnelConnectionState.CONNECTED)
        
        logger.info('Tunnel subscription active:', { channel: userChannel })

      } catch (err) {
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to connect to tunnel'
          setError(errorMessage)
          setConnectionState(TunnelConnectionState.ERROR)
          setIsConnected(false)
          hasSubscribedRef.current = false
          logger.error('Tunnel connection failed:', err)
        }
      }
    }

    setupSubscription()

    // Cleanup on unmount ONLY
    return () => {
      mounted = false
      
      // Only cleanup subscription on actual unmount
      if (subscriptionRef.current && managerRef.current) {
        const subId = subscriptionRef.current.id
        managerRef.current.unsubscribe(subId).catch(() => {})
        activeSubscriptions.delete(userChannel)
        hasSubscribedRef.current = false
        subscriptionRef.current = null
        logger.debug('Tunnel subscription cleaned up:', { channel: userChannel })
      }
    }
  // Minimal dependencies - only re-run when auth status or channel changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, enabled, status, session?.user?.id])

  // Reset when user logs out
  useEffect(() => {
    if (status === 'unauthenticated') {
      setData(null)
      setIsConnected(false)
      setConnectionState(TunnelConnectionState.DISCONNECTED)
      setError(null)
      hasSubscribedRef.current = false
      userIdRef.current = null
    }
  }, [status])

  const reconnect = useCallback(() => {
    // Force reconnection
    hasSubscribedRef.current = false
    if (userIdRef.current) {
      activeSubscriptions.delete(`${channel}:${userIdRef.current}`)
    }
    clientTunnelManager = null
    connectionPromise = null
    // Trigger re-subscription by updating state
    setConnectionState(TunnelConnectionState.DISCONNECTED)
  }, [channel])

  return {
    data,
    isConnected,
    connectionState,
    error,
    reconnect
  }
}

/**
 * Hook to get tunnel connection status
 * Used for connection indicator in UI
 */
export function useTunnelStatus() {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionState, setConnectionState] = useState<TunnelConnectionState>(
    TunnelConnectionState.DISCONNECTED
  )
  const [latency, setLatency] = useState<number | null>(null)

  useEffect(() => {
    let mounted = true

    const checkStatus = () => {
      try {
        if (clientTunnelManager && mounted) {
          const health = clientTunnelManager.getHealth()
          setIsConnected(health.state === TunnelConnectionState.CONNECTED)
          setConnectionState(health.state)
          setLatency(health.latency)
        }
      } catch {
        // Ignore errors
      }
    }

    // Check immediately
    checkStatus()

    // Then check every 5 seconds
    const interval = setInterval(checkStatus, 5000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  return {
    isConnected,
    connectionState,
    latency
  }
}
