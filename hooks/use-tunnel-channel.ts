'use client'

/**
 * Tunnel channel subscription via TunnelProvider (path A).
 * Replaces removed helpers: useTunnelNotifications, useTunnelMessages, useTunnelPresence.
 *
 * @see lib/tunnel/SUBSCRIPTION-SSOT.md — removal report and superseding modules
 * @see AI-CONTEXT ring-platform.org/concepts/hooks-provider-subscription-matrix.json
 * @see .cursor/plans/ring_tunnel_remediation_3d0da11b.plan.md (useTunnelChannel SSOT)
 *
 * BACKLOG: see channel-subscription-registry.ts header and tunnel-protocol.mdx widgets.
 */

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useTunnel } from '@/hooks/use-tunnel'
import { TunnelConnectionState, type TunnelMessage } from '@/lib/tunnel/types'

export interface UseTunnelChannelOptions<T> {
  /** Base channel name (e.g. `notifications:inbox`, `credit:balance`). */
  channel: string
  /** When true, subscribes to `${channel}:${userId}` (credit balance pattern). */
  userScoped?: boolean
  enabled?: boolean
  onMessage?: (payload: T, message: TunnelMessage) => void
  /** Invoked for every message on the channel (including empty payloads). */
  onTunnelMessage?: (message: TunnelMessage) => void
}

export interface UseTunnelChannelReturn<T> {
  data: T | null
  isConnected: boolean
  connectionState: TunnelConnectionState
  channel: string | null
  error: string | null
}

export function useTunnelChannel<T = unknown>(
  options: UseTunnelChannelOptions<T>,
): UseTunnelChannelReturn<T> {
  const { channel, userScoped = false, enabled = true, onMessage, onTunnelMessage } = options
  const { data: session, status } = useSession()
  const { isConnected, subscribe, connectionState, error: tunnelError } = useTunnel({
    autoConnect: false,
  })

  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  const onTunnelMessageRef = useRef(onTunnelMessage)
  onTunnelMessageRef.current = onTunnelMessage

  const subscribeRef = useRef(subscribe)
  subscribeRef.current = subscribe

  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)

  const userId = session?.user?.id
  const resolvedChannel =
    enabled && status === 'authenticated' && userId
      ? userScoped
        ? `${channel}:${userId}`
        : channel
      : null

  useEffect(() => {
    if (!resolvedChannel || !isConnected) {
      return
    }

    let unsubscribe: (() => void) | null = null

    try {
      unsubscribe = subscribeRef.current(resolvedChannel, (message: TunnelMessage) => {
        onTunnelMessageRef.current?.(message)

        const payload = message.payload as T
        if (payload === undefined || payload === null) {
          return
        }
        setData(payload)
        setError(null)
        onMessageRef.current?.(payload, message)
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Tunnel subscribe failed'
      setError(message)
    }

    return () => {
      unsubscribe?.()
    }
  }, [resolvedChannel, isConnected])

  return {
    data,
    isConnected: Boolean(resolvedChannel && isConnected),
    connectionState: connectionState ?? TunnelConnectionState.DISCONNECTED,
    channel: resolvedChannel,
    error: error ?? (tunnelError?.message ?? null),
  }
}
