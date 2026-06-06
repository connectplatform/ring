import {
  TunnelConnectionState,
  TunnelProvider as TunnelProviderType,
  type TunnelHealth,
} from '@/lib/tunnel/types'

/**
 * Static tunnel context for cacheComponents / static shell (Suspense fallback).
 * Real connection is established in TunnelProviderRuntime after hydration.
 */
export type TunnelContextValue = {
  isConnected: boolean
  connectionState: TunnelConnectionState
  provider: TunnelProviderType | null
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  manualConnect?: () => Promise<void>
  publish: (channel: string, event: string, data: unknown) => Promise<void>
  subscribe: (channel: string, handler: (message: unknown) => void) => () => void
  health: TunnelHealth | null
  latency: number
  switchProvider: (provider: TunnelProviderType) => Promise<void>
  availableProviders: TunnelProviderType[]
  error: Error | null
}

export const DISCONNECTED_TUNNEL_CONTEXT: TunnelContextValue = {
  isConnected: false,
  connectionState: TunnelConnectionState.DISCONNECTED,
  provider: null,
  connect: async () => {},
  disconnect: async () => {},
  manualConnect: async () => {},
  publish: async () => {
    throw new Error('Tunnel not connected')
  },
  subscribe: () => () => {},
  health: null,
  latency: 0,
  switchProvider: async () => {},
  availableProviders: [],
  error: null,
}
