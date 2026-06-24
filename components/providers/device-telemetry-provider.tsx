'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { getOrCreateDeviceFingerprint } from '@/lib/notifications/device-fingerprint'
import {
  collectDeviceContextSnapshot,
  deviceContextSignature,
  readCachedGeoSnapshot,
  requestCoarseGeoOnce,
} from '@/lib/analytics/device-context'
import type { RealtimeDataDomain } from '@/lib/tunnel/realtime-data-types'

const DEFAULT_DOMAIN: RealtimeDataDomain = 'device_health'
const MIN_POST_INTERVAL_MS = 30_000
const RESIZE_DEBOUNCE_MS = 500

interface DeviceTelemetryProviderProps {
  children: React.ReactNode
  /** Request coarse geolocation once per session (opt-in browser prompt). */
  enableGeo?: boolean
}

/**
 * Collects coalesced device context snapshots for fraud forensics + usability.
 * Posts to /api/analytics/device (Ring Analytics); does not require tunnel WSS.
 */
export function DeviceTelemetryProvider({
  children,
  enableGeo = false,
}: DeviceTelemetryProviderProps) {
  const { data: session, status } = useSession()
  const lastPostAtRef = useRef(0)
  const lastSignatureRef = useRef('')
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const geoRequestedRef = useRef(false)

  const postSnapshot = useCallback(async (force = false) => {
    if (status !== 'authenticated' || !session?.user?.id) return
    if (typeof window === 'undefined') return

    const now = Date.now()
    const snapshot = collectDeviceContextSnapshot()
    const geo = readCachedGeoSnapshot()
    if (geo) snapshot.geo = geo

    const signature = deviceContextSignature(snapshot)
    const elapsed = now - lastPostAtRef.current
    if (!force && signature === lastSignatureRef.current && elapsed < MIN_POST_INTERVAL_MS) {
      return
    }

    lastSignatureRef.current = signature
    lastPostAtRef.current = now

    const deviceId = getOrCreateDeviceFingerprint()
    const body = {
      domain: DEFAULT_DOMAIN,
      deviceId,
      ts: now,
      payload: snapshot,
    }

    try {
      await fetch('/api/analytics/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
      })
    } catch {
      // Non-blocking — analytics must not break UX
    }
  }, [session?.user?.id, status])

  useEffect(() => {
    if (status !== 'authenticated') return

    void postSnapshot(true)

    if (enableGeo && !geoRequestedRef.current) {
      geoRequestedRef.current = true
      void requestCoarseGeoOnce().then(() => postSnapshot(true))
    }

    const onResize = () => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current)
      resizeTimerRef.current = setTimeout(() => {
        void postSnapshot(false)
      }, RESIZE_DEBOUNCE_MS)
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void postSnapshot(false)
      }
    }

    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVisibility)

    const interval = setInterval(() => {
      void postSnapshot(false)
    }, MIN_POST_INTERVAL_MS)

    return () => {
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current)
      clearInterval(interval)
    }
  }, [enableGeo, postSnapshot, status])

  return <>{children}</>
}
