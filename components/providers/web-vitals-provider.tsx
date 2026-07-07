'use client'

import React, { useCallback, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useReportWebVitals } from 'next/web-vitals'

interface WebVitalsProviderProps {
  children: React.ReactNode
}

/** Debounce window before flushing buffered metrics as one batched POST. */
const FLUSH_DEBOUNCE_MS = 1500

interface BufferedMetric {
  id: string
  name: string
  value: number
  delta: number
  rating?: string
  navigationType?: string
}

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * `useReportWebVitals` (next/web-vitals) fires its callback once per Core Web
 * Vital (CLS, FCP, LCP, TTFB, INP) — up to 5 individual POSTs per page load
 * with no built-in batching. This buffers them into one request per debounce
 * window, shaped to match `webVitalsPayloadSchema` directly
 * (features/analytics/lib/analytics-db.ts) so the server's pass-through
 * validation path applies with no normalization needed.
 */
export function WebVitalsProvider({ children }: WebVitalsProviderProps) {
  const { data: session } = useSession()
  const userIdRef = useRef<string | undefined>(session?.user?.id)
  userIdRef.current = session?.user?.id

  const sessionIdRef = useRef<string>('')
  if (!sessionIdRef.current) {
    sessionIdRef.current = generateSessionId()
  }

  const bufferRef = useRef<BufferedMetric[]>([])
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }
    if (bufferRef.current.length === 0 || typeof window === 'undefined') return

    const metrics = bufferRef.current
    bufferRef.current = []

    fetch('/api/analytics/web-vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionIdRef.current,
        url: window.location.href,
        userAgent: navigator.userAgent,
        metrics,
        timestamp: Date.now(),
        userId: userIdRef.current ?? null,
      }),
      keepalive: true,
    }).catch((err) => console.error('Failed to report Web Vitals batch:', err))
  }, [])

  useReportWebVitals((metric) => {
    bufferRef.current.push({
      id: metric.id,
      name: metric.name,
      value: metric.value,
      delta: metric.delta,
      rating: metric.rating,
      navigationType: metric.navigationType,
    })

    if (process.env.NODE_ENV === 'development') {
      console.log('Web Vitals (buffered):', metric.name, metric.value, metric.rating)
    }

    if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
    flushTimerRef.current = setTimeout(flush, FLUSH_DEBOUNCE_MS)
  })

  // Flush on tab hide/navigation-away and on unmount so buffered metrics near
  // the debounce window's edge are never silently dropped.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [flush])

  return <>{children}</>
}
