'use client'

/**
 * Tunnel connection status via shared TunnelProvider (path A).
 * Replaces deprecated useTunnelStatus from use-tunnel-subscription singleton.
 */
import { useRealtimeConnection } from '@/hooks/use-realtime'
import { TunnelConnectionState } from '@/lib/tunnel/types'

export interface UseTunnelConnectionStatusReturn {
  isConnected: boolean
  connectionState: TunnelConnectionState
  latency: number
  reconnect: () => Promise<void>
}

export function useTunnelConnectionStatus(): UseTunnelConnectionStatusReturn {
  const { isConnected, connectionState, latency, reconnect } = useRealtimeConnection()

  return {
    isConnected,
    connectionState,
    latency,
    reconnect,
  }
}
