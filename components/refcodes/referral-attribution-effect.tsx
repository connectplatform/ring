'use client'

import { useEffect, useRef } from 'react'
import { REF_VISIBLE_COOKIE_NAME } from '@/features/refcodes/constants'

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

/**
 * Fires visit beacon when ring_ref_visible is set; shows nothing.
 */
export function ReferralAttributionEffect() {
  const tracked = useRef(false)

  useEffect(() => {
    if (tracked.current) return
    const code = readCookie(REF_VISIBLE_COOKIE_NAME)
    if (!code) return
    tracked.current = true
    void fetch('/api/refcodes/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      keepalive: true,
    }).catch(() => {})
  }, [])

  return null
}
