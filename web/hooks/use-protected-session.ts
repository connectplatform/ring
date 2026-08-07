'use client'

/**
 * useProtectedSession — React 19 / Auth.js helper for routes already gated by
 * SessionAuthGuard (or equivalent server layout).
 *
 * Never auto-redirects to LOGIN: a brief `unauthenticated` flash during client
 * hydrate must not bounce users who already passed the server guard.
 *
 * TODO: Migrate remaining soft "logged out" UI flashes (settings-content,
 * confidential-entities, test-fcm) to this hook for consistent wait-on-loading UX.
 */

import { useSession } from 'next-auth/react'
import type { Session } from 'next-auth'

export interface ProtectedSessionResult {
  session: Session | null
  status: 'loading' | 'authenticated' | 'unauthenticated'
  /** True while Auth.js is resolving; show a local spinner — do not redirect. */
  isLoading: boolean
  isAuthenticated: boolean
  /** Should be rare on protected mounts after SessionProvider SSR hydrate. */
  isUnauthenticated: boolean
  user: Session['user'] | undefined
}

export function useProtectedSession(): ProtectedSessionResult {
  const { data: session, status } = useSession()
  return {
    session: session ?? null,
    status,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    isUnauthenticated: status === 'unauthenticated',
    user: session?.user,
  }
}
