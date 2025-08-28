/**
 * Modern Real-time Communication Hooks
 * Built on top of Tunnel Transport Manager for intelligent transport selection
 * Replaces legacy WebSocket hooks with a unified real-time communication layer
 */

'use client'

import { useEffect, useState, useCallback, useRef, useOptimistic } from 'react'
import { useSession } from 'next-auth/react'
import { useTunnel, useTunnelNotifications, useTunnelMessages } from './use-tunnel'
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

export function useRealtimeNotifications() {
  const { notifications: tunnelNotifications, clearNotifications } = useTunnelNotifications()
  const [unreadCount, setUnreadCount] = useState(0)
  
  // Convert tunnel messages to notification format
  const notifications: NotificationData[] = tunnelNotifications.map(msg => ({
    id: msg.id,
    type: msg.payload?.type || 'notification',
    title: msg.payload?.title || '',
    body: msg.payload?.body || '',
    timestamp: new Date(msg.metadata?.timestamp || Date.now()),
    priority: msg.payload?.priority || 'normal',
    data: msg.payload?.data,
    read: msg.payload?.read || false,
  }))

  // Calculate unread count
  useEffect(() => {
    const unread = notifications.filter(n => !n.read).length
    setUnreadCount(unread)
  }, [notifications])

  // Mark notifications as read
  const markAsRead = useCallback(async (notificationIds: string[]) => {
    // In a real implementation, this would update the backend
    // For now, we'll just update locally
    console.log('Marking as read:', notificationIds)
  }, [])

  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    await markAsRead(unreadIds)
  }, [notifications, markAsRead])

  return {
    notifications,
    unreadCount,
    lastNotification: notifications[0] || null,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    refresh: () => {
      // Trigger a refresh if needed
      console.log('Refreshing notifications')
    }
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
  const { messages: tunnelMessages, sendMessage } = useTunnelMessages(channel)
  const [typingUsers, setTypingUsers] = useState<Map<string, Date>>(new Map())
  
  // Convert tunnel messages to message format
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

    await sendMessage(message)
  }, [conversationId, sendMessage])

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
    autoConnect: false, // Let TunnelProvider handle this
    debug: false // Disable debug to prevent spam
  })
  
  // Stable references to avoid re-subscriptions
  const isConnected = tunnel.isConnected
  const subscribe = tunnel.subscribe
  const publish = tunnel.publish

  useEffect(() => {
    if (!isConnected) return

    // Subscribe to presence channel
    const unsubscribe = subscribe('presence', (message) => {
      if (message.payload?.userId) {
        setPresence(prev => {
          const updated = new Map(prev)
          updated.set(message.payload.userId, {
            userId: message.payload.userId,
            status: message.payload.status || 'online',
            lastSeen: new Date(message.payload.lastSeen || Date.now()),
          })
          return updated
        })
      }
    })

    return unsubscribe
  }, [isConnected, subscribe])

  const updateStatus = useCallback(async (status: 'online' | 'away' | 'offline') => {
    await publish('presence', 'status', { status })
  }, [publish])

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
    autoConnect: false, // Let TunnelProvider handle this
    debug: false // Disable debug to prevent spam
  })
  const [systemStatus, setSystemStatus] = useState({
    isHealthy: true,
    maintenanceMode: false,
    message: null as string | null,
  })
  
  // Stable references to avoid re-subscriptions
  const isConnected = tunnel.isConnected
  const subscribe = tunnel.subscribe
  const latency = tunnel.latency
  const provider = tunnel.provider
  const health = tunnel.health

  useEffect(() => {
    if (!isConnected) return

    // Subscribe to system channel
    const unsubscribe = subscribe('system', (message) => {
      if (message.payload?.type === 'maintenance') {
        setSystemStatus(prev => ({
          ...prev,
          maintenanceMode: message.payload.enabled,
          message: message.payload.message,
        }))
      } else if (message.payload?.type === 'health') {
        setSystemStatus(prev => ({
          ...prev,
          isHealthy: message.payload.healthy,
        }))
      }
    })

    return unsubscribe
  }, [isConnected, subscribe])

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
 * Legacy aliases for backward compatibility
 */
export const useWebSocket = useRealtimeConnection
export const useWebSocketSystem = useRealtimeSystemStatus
