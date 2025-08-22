/**
 * Modern WebSocket Hooks for React 19
 * Optimized for performance with automatic cleanup and subscription management
 */

'use client'

import { useEffect, useState, useCallback, useRef, useSyncExternalStore, use, useOptimistic } from 'react'
import { useSession } from 'next-auth/react'
import { websocketManager, WebSocketState } from '@/lib/websocket/websocket-manager'

/**
 * Stable server snapshot for SSR to prevent infinite loops
 * This needs to be a constant reference, not created on each render
 */
const SERVER_SNAPSHOT: WebSocketState = {
  status: 'disconnected',
  reconnectAttempts: 0,
  isAuthenticated: false,
  lastError: null,
  lastConnected: null
}

/**
 * Core WebSocket hook with React 19 optimizations using useSyncExternalStore
 */
export function useWebSocketConnection() {
  const { status: sessionStatus } = useSession()
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  // Use React 19 useSyncExternalStore for better external state management
  const state = useSyncExternalStore(
    // Subscribe function
    (callback) => {
      const handleStateChange = (newState: WebSocketState) => {
        callback()
        if (newState.status === 'connected') {
          setConnectionError(null)
        }
      }

      websocketManager.on('stateChange', handleStateChange)
      return () => {
        websocketManager.off('stateChange', handleStateChange)
      }
    },
    // Get snapshot function
    () => websocketManager.getState(),
    // Server snapshot function (for SSR) - must return stable reference
    () => SERVER_SNAPSHOT
  )

  // Connect when authenticated
  useEffect(() => {
    if (sessionStatus === 'authenticated' && !websocketManager.isConnected) {
      websocketManager.connect().catch(error => {
        if (mountedRef.current) {
          setConnectionError(error.message)
        }
      })
    } else if (sessionStatus === 'unauthenticated' && websocketManager.isConnected) {
      websocketManager.disconnect()
    }

    return () => {
      mountedRef.current = false
    }
  }, [sessionStatus])

  // Handle connection errors
  useEffect(() => {
    const handleError = (error: any) => {
      if (mountedRef.current) {
        setConnectionError(error.message || 'Connection error')
      }
    }

    websocketManager.on('error', handleError)

    return () => {
      websocketManager.off('error', handleError)
    }
  }, [])

  const reconnect = useCallback(async () => {
    try {
      await websocketManager.connect()
    } catch (error) {
      setConnectionError((error as Error).message)
    }
  }, [])

  const disconnect = useCallback(() => {
    websocketManager.disconnect()
  }, [])

  const send = useCallback((event: string, data: any) => {
    return websocketManager.send(event, data)
  }, [])

  return {
    isConnected: state.status === 'connected',
    isConnecting: state.status === 'connecting',
    isReconnecting: state.status === 'reconnecting',
    status: state.status,
    error: connectionError || state.lastError,
    reconnectAttempts: state.reconnectAttempts,
    lastConnected: state.lastConnected,
    reconnect,
    disconnect,
    send,
  }
}

/**
 * Hook for WebSocket notifications with automatic subscription management
 */
interface NotificationData {
  id: string
  type: string
  title: string
  body: string
  timestamp: Date
  priority: 'low' | 'normal' | 'high' | 'urgent'
  data?: any
}

export function useWebSocketNotifications() {
  const [notifications, setNotifications] = useState<NotificationData[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [lastNotification, setLastNotification] = useState<NotificationData | null>(null)
  const maxNotifications = useRef(100)

  // React 19 useOptimistic for optimistic notification reads
  const [optimisticNotifications, addOptimisticUpdate] = useOptimistic(
    notifications,
    (currentNotifications, action: { type: 'markRead', ids: string[] }) => {
      if (action.type === 'markRead') {
        return currentNotifications.map(n => 
          action.ids.includes(n.id) 
            ? { ...n, read: true } 
            : n
        ) as NotificationData[]
      }
      return currentNotifications
    }
  )

  useEffect(() => {
    // Handle single notification
    const handleNotification = (notification: NotificationData) => {
      setNotifications(prev => {
        const updated = [notification, ...prev]
        // Keep only the latest N notifications
        return updated.slice(0, maxNotifications.current)
      })
      setLastNotification(notification)
      setUnreadCount(prev => prev + 1)
    }

    // Handle batch notifications
    const handleBatchNotifications = (batch: NotificationData[]) => {
      setNotifications(prev => {
        const updated = [...batch, ...prev]
        return updated.slice(0, maxNotifications.current)
      })
      if (batch.length > 0) {
        setLastNotification(batch[0])
      }
      setUnreadCount(prev => prev + batch.length)
    }

    // Handle unread count updates from server
    const handleUnreadCount = (count: number) => {
      setUnreadCount(count)
    }

    // Subscribe to notification events
    websocketManager.on('notification', handleNotification)
    websocketManager.on('notifications', handleBatchNotifications)
    websocketManager.on('unreadCount', handleUnreadCount)

    // Subscribe to notification channel
    websocketManager.subscribe('user:notifications')

    // Request initial unread count
    if (websocketManager.isConnected) {
      websocketManager.requestNotificationCount()
    }

    return () => {
      websocketManager.off('notification', handleNotification)
      websocketManager.off('notifications', handleBatchNotifications)
      websocketManager.off('unreadCount', handleUnreadCount)
      websocketManager.unsubscribe('user:notifications')
    }
  }, [])

  const markAsRead = useCallback((notificationIds: string[]) => {
    // React 19 optimistic update - update UI immediately
    addOptimisticUpdate({ type: 'markRead', ids: notificationIds })
    setUnreadCount(prev => Math.max(0, prev - notificationIds.length))
    
    // Send to server (may fail, causing rollback)
    websocketManager.markNotificationsRead(notificationIds)
  }, [addOptimisticUpdate])

  const markAllAsRead = useCallback(() => {
    const unreadIds = notifications
      .filter(n => !(n as any).read)
      .map(n => n.id)
    
    if (unreadIds.length > 0) {
      markAsRead(unreadIds)
    }
  }, [notifications, markAsRead])

  const clearNotifications = useCallback(() => {
    setNotifications([])
    setLastNotification(null)
  }, [])

  const refresh = useCallback(() => {
    websocketManager.requestNotificationCount()
  }, [])

  return {
    notifications: optimisticNotifications, // Use optimistic state for better UX
    unreadCount,
    lastNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    refresh,
  }
}

/**
 * Hook for WebSocket messages with typing indicators
 */
export function useWebSocketMessages(conversationId?: string) {
  const [messages, setMessages] = useState<any[]>([])
  const [typingUsers, setTypingUsers] = useState<Map<string, boolean>>(new Map())
  const typingTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // React 19 useOptimistic for optimistic message sending
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (currentMessages, newMessage: any) => [...currentMessages, newMessage]
  )

  useEffect(() => {
    if (!conversationId) return

    const handleMessage = (message: any) => {
      if (message.conversationId === conversationId) {
        setMessages(prev => [...prev, message])
      }
    }

    const handleTyping = (data: { userId: string; conversationId: string; isTyping: boolean }) => {
      if (data.conversationId !== conversationId) return

      setTypingUsers(prev => {
        const updated = new Map(prev)
        if (data.isTyping) {
          updated.set(data.userId, true)
          
          // Clear existing timeout
          const existingTimeout = typingTimeouts.current.get(data.userId)
          if (existingTimeout) {
            clearTimeout(existingTimeout)
          }
          
          // Set timeout to remove typing indicator after 5 seconds
          const timeout = setTimeout(() => {
            setTypingUsers(p => {
              const u = new Map(p)
              u.delete(data.userId)
              return u
            })
          }, 5000)
          
          typingTimeouts.current.set(data.userId, timeout)
        } else {
          updated.delete(data.userId)
          const timeout = typingTimeouts.current.get(data.userId)
          if (timeout) {
            clearTimeout(timeout)
            typingTimeouts.current.delete(data.userId)
          }
        }
        return updated
      })
    }

    websocketManager.on('message', handleMessage)
    websocketManager.on('typing', handleTyping)
    websocketManager.subscribe(`conversation:${conversationId}`)

    return () => {
      websocketManager.off('message', handleMessage)
      websocketManager.off('typing', handleTyping)
      websocketManager.unsubscribe(`conversation:${conversationId}`)
      
      // Clear all typing timeouts
      typingTimeouts.current.forEach(timeout => clearTimeout(timeout))
      typingTimeouts.current.clear()
    }
  }, [conversationId])

  const sendMessage = useCallback((content: string, metadata?: any) => {
    if (!conversationId) return false
    
    // React 19 optimistic update - show message immediately
    const tempMessage = {
      id: `temp-${Date.now()}`,
      conversationId,
      content,
      metadata,
      timestamp: new Date().toISOString(),
      status: 'sending',
      isOptimistic: true
    }
    
    addOptimisticMessage(tempMessage)
    
    // Send to server (will replace temp message when confirmed)
    return websocketManager.send('message:send', {
      conversationId,
      content,
      metadata,
      timestamp: tempMessage.timestamp,
      tempId: tempMessage.id // Server uses this to replace temp message
    })
  }, [conversationId, addOptimisticMessage])

  const startTyping = useCallback(() => {
    if (!conversationId) return
    websocketManager.send('typing:start', { conversationId })
  }, [conversationId])

  const stopTyping = useCallback(() => {
    if (!conversationId) return
    websocketManager.send('typing:stop', { conversationId })
  }, [conversationId])

  return {
    messages: optimisticMessages, // Use optimistic state for better UX
    typingUsers: Array.from(typingUsers.keys()),  
    sendMessage,
    startTyping,
    stopTyping,
  }
}

/**
 * Hook for WebSocket presence/online status
 */
export function useWebSocketPresence() {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [userPresence, setUserPresence] = useState<Map<string, { isOnline: boolean; lastSeen?: Date }>>(new Map())

  useEffect(() => {
    const handlePresence = (data: { userId: string; isOnline: boolean; lastSeen?: string }) => {
      setUserPresence(prev => {
        const updated = new Map(prev)
        updated.set(data.userId, {
          isOnline: data.isOnline,
          lastSeen: data.lastSeen ? new Date(data.lastSeen) : undefined,
        })
        return updated
      })

      setOnlineUsers(prev => {
        const updated = new Set(prev)
        if (data.isOnline) {
          updated.add(data.userId)
        } else {
          updated.delete(data.userId)
        }
        return updated
      })
    }

    websocketManager.on('presence', handlePresence)
    websocketManager.subscribe('presence:updates')

    return () => {
      websocketManager.off('presence', handlePresence)
      websocketManager.unsubscribe('presence:updates')
    }
  }, [])

  const isUserOnline = useCallback((userId: string): boolean => {
    return onlineUsers.has(userId)
  }, [onlineUsers])

  const getUserPresence = useCallback((userId: string) => {
    return userPresence.get(userId) || { isOnline: false }
  }, [userPresence])

  return {
    onlineUsers: Array.from(onlineUsers),
    onlineCount: onlineUsers.size,
    isUserOnline,
    getUserPresence,
  }
}

/**
 * Hook for system events (maintenance, updates, etc.)
 */
export function useWebSocketSystem() {
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [systemUpdate, setSystemUpdate] = useState<any>(null)
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor'>('good')
  const pingCount = useRef(0)
  const pongCount = useRef(0)

  useEffect(() => {
    const handleMaintenance = (data: { enabled: boolean; message?: string; estimatedTime?: number }) => {
      setMaintenanceMode(data.enabled)
      if (data.enabled && data.message) {
        console.warn('System maintenance:', data.message)
      }
    }

    const handleSystemUpdate = (data: any) => {
      setSystemUpdate(data)
    }

      const handlePing = () => {
    pingCount.current++
    // Don't update quality immediately on ping - wait for pong
  }

  const handleHeartbeat = () => {
    pongCount.current++
    // Only update quality when we receive a pong response
    updateConnectionQuality()
  }

    const updateConnectionQuality = () => {
      const ratio = pongCount.current / Math.max(pingCount.current, 1)
      
      // More lenient thresholds for local development
      // Local networks can have minor fluctuations
      if (ratio > 0.85) {
        setConnectionQuality('excellent')
      } else if (ratio > 0.60) {
        setConnectionQuality('good')
      } else {
        setConnectionQuality('poor')
      }
      
      // Log quality metrics in development
      if (process.env.NODE_ENV === 'development' && pingCount.current > 0) {
        console.log(`WebSocket Quality: ${(ratio * 100).toFixed(1)}% (${pongCount.current}/${pingCount.current} pongs) - ${connectionQuality}`)
      }
    }

    websocketManager.on('maintenance', handleMaintenance)
    websocketManager.on('systemUpdate', handleSystemUpdate)
    websocketManager.on('ping', handlePing)
    websocketManager.on('heartbeat', handleHeartbeat)

    // Reset counters periodically and recalculate quality
    const resetInterval = setInterval(() => {
      // Only reset if we have enough data points
      if (pingCount.current >= 5) {
        pingCount.current = 0
        pongCount.current = 0
        // Start with excellent quality after reset
        setConnectionQuality('excellent')
      }
    }, 60000) // Every minute

    return () => {
      websocketManager.off('maintenance', handleMaintenance)
      websocketManager.off('systemUpdate', handleSystemUpdate)
      websocketManager.off('ping', handlePing)
      websocketManager.off('heartbeat', handleHeartbeat)
      clearInterval(resetInterval)
    }
  }, [])

  return {
    maintenanceMode,
    systemUpdate,
    connectionQuality,
  }
}

/**
 * Combined hook for all WebSocket features
 */
export function useWebSocket() {
  const connection = useWebSocketConnection()
  const notifications = useWebSocketNotifications()
  const presence = useWebSocketPresence()
  const system = useWebSocketSystem()

  return {
    ...connection,
    notifications,
    presence,
    system,
  }
}
