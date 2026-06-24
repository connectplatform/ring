/**
 * Modern Real-time Communication Hooks
 * Built on top of Tunnel Transport Manager for intelligent transport selection
 * Replaces legacy WebSocket hooks with a unified real-time communication layer
 */

'use client'

import { useEffect, useState, useCallback, useRef, useOptimistic } from 'react'
import { useSession } from 'next-auth/react'
import { useTunnel } from './use-tunnel'
import { useTunnelChannel } from './use-tunnel-channel'
import { useNotificationContext } from '@/features/notifications/components/notification-provider'
import { NotificationType } from '@/features/notifications/types'
import { TunnelConnectionState, TunnelMessage } from '@/lib/tunnel/types'

/**
 * Core real-time connection hook
 * Provides a clean API for real-time communication using the best available transport
 */
export function useRealtimeConnection() {
  const { status: sessionStatus } = useSession()
  
  // Use the tunnel transport system - let TunnelProvider handle auto-connect
  const tunnel = useTunnel({
    autoConnect: false, // Let TunnelProvider handle this
    debug: false // Disable debug to prevent spam
  })

  // Map tunnel state to legacy WebSocket status
  const status = tunnel.isConnected ? 'connected' as const :
                 tunnel.connectionState === TunnelConnectionState.CONNECTING ? 'connecting' as const :
                 tunnel.connectionState === TunnelConnectionState.RECONNECTING ? 'reconnecting' as const :
                 tunnel.connectionState === TunnelConnectionState.ERROR ? 'error' as const :
                 'disconnected' as const

  return {
    // Connection state
    isConnected: tunnel.isConnected,
    isConnecting: tunnel.connectionState === TunnelConnectionState.CONNECTING,
    isReconnecting: tunnel.connectionState === TunnelConnectionState.RECONNECTING,
    connectionState: tunnel.connectionState,
    status, // Legacy compatibility
    
    // Transport info
    provider: tunnel.provider,
    availableProviders: tunnel.availableProviders,
    
    // Health metrics
    latency: tunnel.latency,
    health: tunnel.health,
    
    // Connection management
    connect: tunnel.connect,
    disconnect: tunnel.disconnect,
    reconnect: tunnel.connect,
    
    // Messaging
    publish: tunnel.publish,
    subscribe: tunnel.subscribe,
    send: (event: string, data: any) => tunnel.publish('default', event, data), // Legacy compatibility
    
    // Transport switching
    switchProvider: tunnel.switchProvider,
    
    // Error handling
    error: tunnel.error,
    
    // Legacy compatibility properties
    reconnectAttempts: 0, // Not tracked in new system
    lastConnected: tunnel.isConnected ? new Date() : undefined,
  }
}

/**
 * Notification hook with real-time updates
 */
interface NotificationData {
  id: string
  type: string
  title: string
  body: string
  timestamp: Date
  priority: 'low' | 'normal' | 'high' | 'urgent'
  data?: any
  read?: boolean
}

export interface UseRealtimeNotificationsOptions {
  /** When set, only prepend notifications matching these types. */
  types?: NotificationType[]
}

export function useRealtimeNotifications(options: UseRealtimeNotificationsOptions = {}) {
  const { types } = options
  const allowedTypesRef = useRef(types)
  allowedTypesRef.current = types

  const { refreshUnreadCount } = useNotificationContext()
  const [notifications, setNotifications] = useState<NotificationData[]>([])

  const matchesTypeFilter = useCallback((notificationType: string) => {
    const allowed = allowedTypesRef.current
    if (!allowed || allowed.length === 0) {
      return true
    }
    return allowed.includes(notificationType as NotificationType)
  }, [])

  const mapInboxPayload = useCallback((payload: Record<string, unknown>): NotificationData | null => {
    const action = String(payload?.action ?? payload?.type ?? 'notification')
    if (action !== 'notification') {
      return null
    }
    const raw = payload?.notification as Record<string, unknown> | undefined
    if (!raw?.id || !raw?.title) {
      return null
    }
    const notificationType = String(raw.type ?? 'notification')
    if (!matchesTypeFilter(notificationType)) {
      return null
    }
    return {
      id: String(raw.id),
      type: notificationType,
      title: String(raw.title),
      body: String(raw.body ?? ''),
      timestamp: raw.createdAt ? new Date(String(raw.createdAt)) : new Date(),
      priority: (raw.priority as NotificationData['priority']) ?? 'normal',
      data: (raw.data as Record<string, unknown>) ?? {},
      read: Boolean(raw.readAt),
    }
  }, [matchesTypeFilter])

  const handleInboxPayload = useCallback((payload: Record<string, unknown>) => {
    const action = String(payload?.action ?? payload?.type ?? 'notification')

    if (action === 'read' && payload.notificationId) {
      const id = String(payload.notificationId)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      )
      void refreshUnreadCount()
      return
    }

    if (action === 'read_all') {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      void refreshUnreadCount()
      return
    }

    if (action === 'delete' && payload.notificationId) {
      const id = String(payload.notificationId)
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      void refreshUnreadCount()
      return
    }

    const mapped = mapInboxPayload(payload)
    if (!mapped) {
      if (action === 'notification') {
        void refreshUnreadCount()
      }
      return
    }
    setNotifications((prev) => [mapped, ...prev.filter((n) => n.id !== mapped.id)].slice(0, 50))
    void refreshUnreadCount()
  }, [mapInboxPayload, refreshUnreadCount])

  const { isConnected } = useTunnelChannel<Record<string, unknown>>({
    channel: 'notifications:inbox',
    enabled: true,
    onMessage: handleInboxPayload,
  })

  const clearNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  const markAsRead = useCallback(async (notificationIds: string[]) => {
    setNotifications((prev) =>
      prev.map((n) => (notificationIds.includes(n.id) ? { ...n, read: true } : n)),
    )
    void refreshUnreadCount()
  }, [refreshUnreadCount])

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    void refreshUnreadCount()
  }, [refreshUnreadCount])

  const unreadCount = notifications.filter((n) => !n.read).length

  return {
    notifications,
    unreadCount,
    isConnected,
    lastNotification: notifications[0] || null,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    refresh: () => {
      void refreshUnreadCount()
    },
  }
}

/**
 * Messaging hook for conversations
 */
interface Message {
  id: string
  conversationId: string
  content: string
  senderId: string
  senderName?: string
  timestamp: Date
  status?: 'sending' | 'sent' | 'delivered' | 'read'
}

export type { Message }

export function useRealtimeMessages(conversationId?: string) {
  const channel = conversationId ? `conversation:${conversationId}` : 'messages'
  const { publish } = useTunnel({ autoConnect: false })
  const [tunnelMessages, setTunnelMessages] = useState<TunnelMessage[]>([])
  const [typingUsers, setTypingUsers] = useState<Map<string, Date>>(new Map())

  const handleTunnelMessage = useCallback((message: TunnelMessage) => {
    setTunnelMessages((prev) => [...prev, message])
  }, [])

  useTunnelChannel({
    channel,
    enabled: Boolean(channel),
    onTunnelMessage: handleTunnelMessage,
  })

  const messages: Message[] = tunnelMessages
    .filter(msg => msg.payload?.conversationId === conversationId || !conversationId)
    .map(msg => ({
      id: msg.id,
      conversationId: msg.payload?.conversationId || conversationId || '',
      content: msg.payload?.content || msg.payload?.text || '',
      senderId: msg.metadata?.userId || msg.payload?.senderId || '',
      timestamp: new Date(msg.metadata?.timestamp || Date.now()),
      status: msg.payload?.status || 'sent',
    }))

  // Handle typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      // Remove stale typing indicators (older than 3 seconds)
      const now = Date.now()
      setTypingUsers(prev => {
        const updated = new Map(prev)
        for (const [userId, timestamp] of updated) {
          if (now - timestamp.getTime() > 3000) {
            updated.delete(userId)
          }
        }
        return updated
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Send a message
  const send = useCallback(async (content: string) => {
    if (!conversationId) {
      throw new Error('Conversation ID is required')
    }

    const message = {
      conversationId,
      content,
      timestamp: Date.now(),
    }

    await publish(channel, 'message', message)
  }, [conversationId, channel, publish])

  // Typing indicators
  const startTyping = useCallback(() => {
    if (!conversationId) return
    // Send typing indicator via tunnel
    console.log('Start typing in:', conversationId)
  }, [conversationId])

  const stopTyping = useCallback(() => {
    if (!conversationId) return
    // Stop typing indicator
    console.log('Stop typing in:', conversationId)
  }, [conversationId])

  return {
    messages,
    sendMessage: send,
    typingUsers: Array.from(typingUsers.keys()),
    startTyping,
    stopTyping,
  }
}

/**
 * Presence hook for user status
 */
interface UserPresence {
  userId: string
  status: 'online' | 'away' | 'offline'
  lastSeen: Date
}

export function useRealtimePresence() {
  const [presence, setPresence] = useState<Map<string, UserPresence>>(new Map())
  const tunnel = useTunnel({
    autoConnect: false,
    debug: false,
  })

  const handlePresenceMessage = useCallback((message: TunnelMessage) => {
    if (message.payload?.userId) {
      setPresence((prev) => {
        const updated = new Map(prev)
        updated.set(message.payload.userId, {
          userId: message.payload.userId,
          status: message.payload.status || 'online',
          lastSeen: new Date(message.payload.lastSeen || Date.now()),
        })
        return updated
      })
    }
  }, [])

  useTunnelChannel({
    channel: 'presence',
    enabled: true,
    onTunnelMessage: handlePresenceMessage,
  })

  const updateStatus = useCallback(async (status: 'online' | 'away' | 'offline') => {
    await tunnel.publish('presence', 'status', { status })
  }, [tunnel])

  const onlineUsersList = Array.from(presence.values()).filter(u => u.status === 'online')
  
  return {
    presence: Array.from(presence.values()),
    onlineUsers: onlineUsersList,
    onlineCount: onlineUsersList.length,
    updateStatus,
    isUserOnline: (userId: string) => presence.get(userId)?.status === 'online',
    getUserPresence: (userId: string) => {
      const user = presence.get(userId)
      return {
        isOnline: user?.status === 'online' || false,
        lastSeen: user?.lastSeen
      }
    }
  }
}

/**
 * System status hook for monitoring
 */
export function useRealtimeSystemStatus() {
  const tunnel = useTunnel({
    autoConnect: false,
    debug: false,
  })
  const [systemStatus, setSystemStatus] = useState({
    isHealthy: true,
    maintenanceMode: false,
    message: null as string | null,
  })

  const handleSystemMessage = useCallback((message: TunnelMessage) => {
    if (message.payload?.type === 'maintenance') {
      setSystemStatus((prev) => ({
        ...prev,
        maintenanceMode: message.payload.enabled,
        message: message.payload.message,
      }))
    } else if (message.payload?.type === 'health') {
      setSystemStatus((prev) => ({
        ...prev,
        isHealthy: message.payload.healthy,
      }))
    }
  }, [])

  useTunnelChannel({
    channel: 'system',
    enabled: true,
    onTunnelMessage: handleSystemMessage,
  })

  const latency = tunnel.latency
  const provider = tunnel.provider
  const health = tunnel.health

  return {
    ...systemStatus,
    connectionQuality: latency < 100 ? 'excellent' : 
                      latency < 300 ? 'good' : 
                      latency < 1000 ? 'fair' : 'poor',
    latency,
    provider,
    health,
  }
}

/**
 * Export all hooks for convenience
 */
export {
  useRealtimeConnection as useConnection,
  useRealtimeNotifications as useNotifications,
  useRealtimeMessages as useMessages,
  useRealtimePresence as usePresence,
  useRealtimeSystemStatus as useSystemStatus,
}

/**
 * Legacy aliases removed — use useRealtimeConnection / useRealtimeNotifications.
 */
