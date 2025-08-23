/**
 * WebSocket Compatibility Layer
 * Redirects all WebSocket functionality to the Tunnel Transport system
 * Maintains backward compatibility while using modern transport architecture
 */

'use client'

// Re-export everything from the new real-time hooks
export * from './use-realtime'

// Also export with legacy names for backward compatibility
export {
  useRealtimeConnection as useWebSocketConnection,
  useRealtimeNotifications as useWebSocketNotifications,
  useRealtimeMessages as useWebSocketMessages,
  useRealtimePresence as useWebSocketPresence,
  useRealtimeSystemStatus as useWebSocketSystemStatus,
} from './use-realtime'