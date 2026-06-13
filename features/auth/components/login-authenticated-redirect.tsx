'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import type { Locale } from '@/i18n/shared'
import { safePostAuthRedirect } from '@/lib/auth/safe-post-auth-redirect'

interface LoginAuthenticatedRedirectProps {
  from?: string
  locale: Locale
  /** Skip while OAuth callback query params are present on the login URL */
  disabled?: boolean
}

/**
 * Client-side post-login redirect for /login.
 *
 * Why client `useSession`, not the edge proxy gate:
 * - The proxy gate (proxy.ts) is *optimistic* — it only checks for the presence of the
 *   session-token cookie. Bouncing an authed user OFF /login at the edge on cookie presence
 *   would loop on a stale/expired cookie: /login → /profile → layout `auth()` fails →
 *   /login?from=/profile → proxy sees cookie → /profile … (infinite).
 * - `useSession` validates the *real* (decoded, unexpired) session, so the bounce only fires
 *   for genuinely authenticated users — no loop risk.
 * - Also avoids blocking the login RSC on server `auth()` + DB init (multi-second cold path).
 *
 * `from` is already locale-resolved by `safePostAuthRedirect`, so we use next/navigation
 * `router.replace` (next-intl's router would double-prefix the locale).
 */
export function LoginAuthenticatedRedirect({
  from,
  locale,
  disabled = false,
}: LoginAuthenticatedRedirectProps) {
  const { status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (disabled || status !== 'authenticated') return
    router.replace(safePostAuthRedirect(from, locale))
  }, [disabled, status, from, locale, router])

  return null
}
