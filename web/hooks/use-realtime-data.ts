'use client'

/**
 * Bidirectional live device/session data over Ring Tunnel (not FCM).
 * Uplink gated on connection + document visibility.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRealtimeConnection } from '@/hooks/use-realtime'
import { useTunnelChannel } from '@/hooks/use-tunnel-channel'
import {
  type RealtimeDataDomain,
  type RealtimeDataMessage,
  telemetryChannelForDomain,
  telemetryUplinkChannel,
} from '@/lib/tunnel/realtime-data-types'

export interface UseRealtimeDataOptions {
  domains: RealtimeDataDomain[]
  deviceId: string
  enabled?: boolean
  uplinkIntervalMs?: number
  requireVisible?: boolean
  onDownlink?: (message: RealtimeDataMessage) => void
}

export interface UseRealtimeDataReturn {
  isConnected: boolean
  lastDownlink: RealtimeDataMessage | null
  publishSample: (domain: RealtimeDataDomain, payload: Record<string, unknown>) => Promise<void>
  error: string | null
}

export function useRealtimeData(options: UseRealtimeDataOptions): UseRealtimeDataReturn {
  const {
    domains,
    deviceId,
    enabled = true,
    uplinkIntervalMs = 0,
    requireVisible = true,
    onDownlink,
  } = options

  const { data: session } = useSession()
  const { isConnected, publish } = useRealtimeConnection()
  const [lastDownlink, setLastDownlink] = useState<RealtimeDataMessage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const onDownlinkRef = useRef(onDownlink)
  onDownlinkRef.current = onDownlink
  const pendingUplinkRef = useRef<RealtimeDataMessage | null>(null)

  const handleDownlink = useCallback((payload: Record<string, unknown>) => {
    const domain = payload.domain as RealtimeDataDomain | undefined
    if (!domain || !payload.deviceId) {
      return
    }
    const message: RealtimeDataMessage = {
      domain,
      deviceId: String(payload.deviceId),
      ts: Number(payload.ts ?? Date.now()),
      payload: (payload.payload as Record<string, unknown>) ?? {},
    }
    setLastDownlink(message)
    onDownlinkRef.current?.(message)
  }, [])

  const primaryDomain = domains[0]
  useTunnelChannel({
    channel: primaryDomain ? telemetryChannelForDomain(primaryDomain) : 'telemetry:noop',
    enabled: enabled && Boolean(session?.user?.id) && domains.length > 0,
    onMessage: (payload) => handleDownlink(payload as Record<string, unknown>),
  })

  const publishSample = useCallback(
    async (domain: RealtimeDataDomain, payload: Record<string, unknown>) => {
      if (!session?.user?.id) {
        setError('Not authenticated')
        return
      }
      const message: RealtimeDataMessage = {
        domain,
        deviceId,
        ts: Date.now(),
        payload,
      }
      try {
        if (isConnected) {
          await publish(telemetryUplinkChannel(), 'sample', message)
        }
        const res = await fetch('/api/tunnel/telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message),
        })
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(err.error || `Telemetry ingest failed (${res.status})`)
        }
        setError(null)
        pendingUplinkRef.current = message
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Uplink publish failed')
      }
    },
    [deviceId, isConnected, publish, session?.user?.id],
  )

  useEffect(() => {
    if (!enabled || !uplinkIntervalMs || uplinkIntervalMs <= 0 || !isConnected) {
      return
    }
    if (requireVisible && typeof document !== 'undefined' && document.hidden) {
      return
    }

    const interval = setInterval(() => {
      const pending = pendingUplinkRef.current
      if (pending) {
        void publish(telemetryUplinkChannel(), 'sample', pending)
      }
    }, uplinkIntervalMs)

    return () => clearInterval(interval)
  }, [enabled, isConnected, publish, requireVisible, uplinkIntervalMs])

  return {
    isConnected,
    lastDownlink,
    publishSample,
    error,
  }
}
