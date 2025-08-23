'use client'

import React, { createContext, useContext, useEffect, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useWebSocketConnection, useWebSocketNotifications, useWebSocketPresence, useWebSocketSystem } from '@/hooks/use-websocket'
import { toast } from '@/hooks/use-toast'

interface WebSocketContextType {
  isConnected: boolean
  isConnecting: boolean
  isReconnecting: boolean
  reconnecting: boolean
  connectionError: string | null
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'
  reconnectAttempts: number
  lastConnected?: Date
  connect: () => Promise<void>
  disconnect: () => void
  send: (event: string, data: any) => Promise<void>
  // Notification features
  notifications: {
    items: any[]
    unreadCount: number
    lastNotification: any | null
    markAsRead: (ids: string[]) => void
    markAllAsRead: () => void
    clear: () => void
    refresh: () => void
  }
  // Presence features
  presence: {
    onlineUsers: string[]
    onlineCount: number
    isUserOnline: (userId: string) => boolean
    getUserPresence: (userId: string) => { isOnline: boolean; lastSeen?: Date }
  }
  // System features
  system: {
    maintenanceMode: boolean
    systemUpdate: any | null
    connectionQuality: 'excellent' | 'good' | 'poor'
  }
}

const WebSocketContext = createContext<WebSocketContextType | null>(null)

export function useWebSocketContext() {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider')
  }
  return context
}

interface WebSocketProviderProps {
  children: React.ReactNode
}

/**
 * Modern WebSocket Provider with React 19 optimizations
 * Replaces polling with real-time push notifications
 */
export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const { status: sessionStatus } = useSession()
  
  // Use our modern WebSocket hooks
  const connection = useWebSocketConnection()
  const notifications = useWebSocketNotifications()
  const presence = useWebSocketPresence()
  const system = useWebSocketSystem()

  // Show toast notifications for important events
  useEffect(() => {
    if (connection.status === 'connected' && connection.reconnectAttempts > 0) {
      toast({
        title: '✅ Real-time connection restored',
        description: 'You are back online',
      })
    } else if (connection.status === 'error' && connection.error) {
      toast({
        title: '⚠️ Connection issue',
        description: connection.error?.message || 'Connection error',
        variant: 'destructive'
      })
    }
  }, [connection.status, connection.reconnectAttempts, connection.error])

  // Show new notifications as toasts
  useEffect(() => {
    if (notifications.lastNotification) {
      const notification = notifications.lastNotification
      
      // Determine toast variant based on priority
      let variant: 'default' | 'destructive' = 'default'
      if (notification.priority === 'urgent' || notification.priority === 'high') {
        variant = 'destructive'
      }
      
      toast({
        title: notification.title,
        description: notification.body,
        variant,
      })
      
      // If there's an action URL, show it in the description
      if (notification.data?.actionUrl) {
        setTimeout(() => {
          window.open(notification.data.actionUrl, '_blank')
        }, 2000) // Auto-open after 2 seconds
      }
    }
  }, [notifications.lastNotification])

  // Handle system maintenance
  useEffect(() => {
    if (system.maintenanceMode) {
      toast({
        title: '🔧 System Maintenance',
        description: 'The system will undergo maintenance soon. Please save your work.',
        variant: 'destructive',
      })
    }
  }, [system.maintenanceMode])

  // Monitor connection quality
  useEffect(() => {
    if (system.connectionQuality === 'poor' && connection.isConnected) {
      toast({
        title: '📶 Poor Connection',
        description: 'Your connection quality is degraded. Some features may be slow.',
      })
    }
  }, [system.connectionQuality, connection.isConnected])

  // React 19 optimization: Stable callback references with proper dependencies
  const stableConnect = useCallback(async () => {
    return connection.reconnect()
  }, [connection])
  
  const stableDisconnect = useCallback(() => {
    connection.disconnect()
  }, [connection])
  
  const stableSend = useCallback((event: string, data: any) => {
    return connection.send(event, data)
  }, [connection])

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<WebSocketContextType>(() => ({
    isConnected: connection.isConnected,
    isConnecting: connection.isConnecting,
    isReconnecting: connection.isReconnecting,
    reconnecting: connection.isReconnecting,
    connectionError: connection.error?.message || null,
    status: connection.status,
    reconnectAttempts: connection.reconnectAttempts,
    lastConnected: connection.lastConnected,
    connect: stableConnect,
    disconnect: stableDisconnect,
    send: stableSend,
    notifications: {
      items: notifications.notifications,
      unreadCount: notifications.unreadCount,
      lastNotification: notifications.lastNotification,
      markAsRead: notifications.markAsRead,
      markAllAsRead: notifications.markAllAsRead,
      clear: notifications.clearNotifications,
      refresh: notifications.refresh,
    },
    presence: {
      onlineUsers: presence.onlineUsers.map(u => u.userId),
      onlineCount: presence.onlineCount,
      isUserOnline: presence.isUserOnline,
      getUserPresence: presence.getUserPresence,
    },
    system: {
      maintenanceMode: system.maintenanceMode,
      systemUpdate: null, // Not available in new system
      connectionQuality: system.connectionQuality as 'excellent' | 'good' | 'poor',
    }
  }), [
    // Connection state
    connection.isConnected,
    connection.isConnecting,
    connection.isReconnecting,
    connection.error,
    connection.status,
    connection.reconnectAttempts,
    connection.lastConnected,
    stableConnect,
    stableDisconnect,
    stableSend,
    // Notification state  
    notifications.notifications,
    notifications.unreadCount,
    notifications.lastNotification,
    notifications.markAsRead,
    notifications.markAllAsRead,
    notifications.clearNotifications,
    notifications.refresh,
    // Presence state
    presence.onlineUsers,
    presence.onlineCount,
    presence.isUserOnline,
    presence.getUserPresence,
    // System state
    system.maintenanceMode,
    // system.systemUpdate, // Not available in new system
    system.connectionQuality
  ])

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  )
}

/**
 * Helper hook for easy WebSocket usage
 * @deprecated Use specific hooks from @/hooks/use-websocket instead
 * This will be removed in a future version
 */
export function useWebSocket() {
  console.warn('useWebSocket from websocket-provider is deprecated. Use hooks from @/hooks/use-websocket instead.')
  return useWebSocketContext()
}