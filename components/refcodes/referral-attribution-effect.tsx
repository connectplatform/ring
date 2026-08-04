'use client'

import { useEffect, useRef } from 'react'
import { REF_VISIBLE_COOKIE_NAME } from '@/features/refcodes/constants'
import { parseReferralHash } from '@/features/refcodes/lib/referral-share-url'

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

/**
 * First-touch attribution:
 * 1. `#username` hash (preferred share format — never reaches Next proxy)
 * 2. `ring_ref_visible` cookie (set by proxy from `?ref=` or prior claim)
 *
 * Posts to /api/refcodes/track which resolves username→refcode, bumps visits,
 * and stamps httpOnly + visible cookies when claim is allowed.
 */
export function ReferralAttributionEffect() {
  const tracked = useRef(false)

  useEffect(() => {
    if (tracked.current) return

    const fromHash = parseReferralHash(window.location.hash)
    const fromCookie = readCookie(REF_VISIBLE_COOKIE_NAME)
    const code = fromHash || fromCookie
    if (!code) return

    tracked.current = true
    void fetch('/api/refcodes/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, claim: true }),
      keepalive: true,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { ok?: boolean; code?: string } | null) => {
        if (!fromHash || !json?.ok) return
        // Drop hash after claim so refresh / share of the landing URL stays clean.
        const { pathname, search } = window.location
        window.history.replaceState(null, '', `${pathname}${search}`)
      })
      .catch(() => {})
  }, [])

  return null
}
