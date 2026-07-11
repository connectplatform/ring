'use client'

import { useCallback, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useTunnelChannel } from '@/hooks/use-tunnel-channel'
import {
  ACCOUNT_STATUS_TUNNEL_CHANNEL,
  type AccountStatusTunnelPayload,
} from '@/lib/tunnel/account-status-channels'
import { ROUTES } from '@/constants/routes'
import { localeFromPathname } from '@/lib/pathname-without-locale'

const DEBOUNCE_MS = 2_000
const MAX_PROCESSED_KEYS = 128

/** Module-scope dedupe across Strict Mode remounts and queue replay bursts. */
const processedMessageKeys = new Set<string>()
let sessionUpdateInFlight: Promise<void> | null = null
let lastSessionUpdateAt = 0

function rememberProcessedKey(key: string): boolean {
  if (processedMessageKeys.has(key)) return false
  processedMessageKeys.add(key)
  if (processedMessageKeys.size > MAX_PROCESSED_KEYS) {
    const oldest = processedMessageKeys.values().next().value
    if (oldest) processedMessageKeys.delete(oldest)
  }
  return true
}

function messageDedupeKey(payload: AccountStatusTunnelPayload): string {
  return `${payload.type}:${payload.at}`
}

function resolveAccountStatus(session: ReturnType<typeof useSession>['data']): string {
  const raw = (session?.user as { accountStatus?: string } | undefined)?.accountStatus
  return raw && raw.length > 0 ? raw : 'ACTIVE'
}

async function coalescedSessionRefresh(
  update: (data?: { accountStatusRefresh?: boolean }) => Promise<unknown>,
): Promise<void> {
  const now = Date.now()
  if (sessionUpdateInFlight) return sessionUpdateInFlight
  if (now - lastSessionUpdateAt < DEBOUNCE_MS) return

  sessionUpdateInFlight = (async () => {
    try {
      await update({ accountStatusRefresh: true })
      lastSessionUpdateAt = Date.now()
      if (process.env.NODE_ENV === 'development') {
        console.debug(JSON.stringify({ tag: 'accountStatus.sessionUpdate', at: lastSessionUpdateAt }))
      }
    } finally {
      sessionUpdateInFlight = null
    }
  })()

  return sessionUpdateInFlight
}

/**
 * Subscribes to account:status tunnel pushes (suspend / reactivate).
 * Composed by GlobalTunnelListeners under TunnelProvider — not mounted directly in AppClientShell.
 * Outside NextIntlClientProvider — use next/navigation (localeFromPathname), not @/i18n/routing.
 */
export function AccountStatusTunnelListener() {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, update } = useSession()

  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname
  const routerRef = useRef(router)
  routerRef.current = router
  const updateRef = useRef(update)
  updateRef.current = update
  const sessionRef = useRef(session)
  sessionRef.current = session

  const handleAccountStatus = useCallback((payload: AccountStatusTunnelPayload) => {
    const dedupeKey = messageDedupeKey(payload)
    if (!rememberProcessedKey(dedupeKey)) {
      if (process.env.NODE_ENV === 'development') {
        console.debug(JSON.stringify({ tag: 'accountStatus.tunnel.skip', reason: 'dedupe', dedupeKey }))
      }
      return
    }

    if (process.env.NODE_ENV === 'development') {
      console.debug(JSON.stringify({ tag: 'accountStatus.tunnel', type: payload.type, at: payload.at }))
    }

    const currentStatus = resolveAccountStatus(sessionRef.current)

    if (payload.type === 'account-suspend-notification') {
      if (currentStatus === 'SUSPENDED') {
        return
      }
      const locale = localeFromPathname(pathnameRef.current)
      void coalescedSessionRefresh(updateRef.current).then(() => {
        routerRef.current.push(ROUTES.ACCOUNT_SUSPENDED(locale))
      })
      return
    }

    if (payload.type === 'account-reactivate-notification') {
      // Fresh sign-in / legacy JWT: undefined accountStatus means ACTIVE — never refresh /profile.
      if (currentStatus !== 'SUSPENDED') {
        if (process.env.NODE_ENV === 'development') {
          console.debug(JSON.stringify({
            tag: 'accountStatus.tunnel.skip',
            reason: 'not_suspended',
            currentStatus,
          }))
        }
        return
      }
      // Session JWT update only — router.refresh() caused multi-GET /profile storms on auth.
      void coalescedSessionRefresh(updateRef.current)
    }
  }, [])

  useTunnelChannel<AccountStatusTunnelPayload>({
    channel: ACCOUNT_STATUS_TUNNEL_CHANNEL,
    userScoped: false,
    onMessage: handleAccountStatus,
  })

  return null
}
