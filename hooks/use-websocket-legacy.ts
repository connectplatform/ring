/**
 * Legacy WebSocket Hooks - Backward Compatibility Layer
 * These hooks redirect to the new Tunnel Transport system
 * Maintains API compatibility while using modern transport layer
 */

'use client'

import {
  useRealtimeConnection,
  useRealtimeNotifications,
  useRealtimeMessages,
  useRealtimePresence,
  useRealtimeSystemStatus,
} from './use-realtime'

/**
 * Legacy WebSocket connection hook
 * @deprecated Use useRealtimeConnection() instead
 */
export function useWebSocketConnection() {
  const realtime = useRealtimeConnection()
  
  // Map to legacy API
  return {
    isConnected: realtime.isConnected,
    isConnecting: realtime.isConnecting,
    isReconnecting: realtime.isReconnecting,
    status: realtime.isConnected ? 'connected' as const : 
            realtime.isConnecting ? 'connecting' as const :
            realtime.isReconnecting ? 'reconnecting' as const : 
            'disconnected' as const,
    error: realtime.error?.message || null,
    reconnectAttempts: 0, // Not tracked in new system
    lastConnected: realtime.isConnected ? new Date() : null,
    reconnect: realtime.reconnect,
    disconnect: realtime.disconnect,
    send: (event: string, data: any) => realtime.publish('default', event, data),
  }
}

/**
 * Legacy WebSocket notifications hook
 * @deprecated Use useRealtimeNotifications() instead
 */
export function useWebSocketNotifications() {
  return useRealtimeNotifications()
}

/**
 * Legacy WebSocket messages hook
 * @deprecated Use useRealtimeMessages() instead
 */
export function useWebSocketMessages(conversationId?: string) {
  return useRealtimeMessages(conversationId)
}

/**
 * Legacy WebSocket presence hook
 * @deprecated Use useRealtimePresence() instead
 */
export function useWebSocketPresence() {
  return useRealtimePresence()
}

/**
 * Legacy WebSocket system status hook
 * @deprecated Use useRealtimeSystemStatus() instead
 */
export function useWebSocketSystemStatus() {
  return useRealtimeSystemStatus()
}

// Export all legacy hooks
export default {
  useWebSocketConnection,
  useWebSocketNotifications,
  useWebSocketMessages,
  useWebSocketPresence,
  useWebSocketSystemStatus,
}
