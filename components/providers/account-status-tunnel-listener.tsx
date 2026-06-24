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

/**
 * Subscribes to account:status tunnel pushes (suspend / reactivate).
 * Composed by GlobalTunnelListeners under TunnelProvider — not mounted directly in AppClientShell.
 * Outside NextIntlClientProvider — use next/navigation (localeFromPathname), not @/i18n/routing.
 */
export function AccountStatusTunnelListener() {
  const router = useRouter()
  const pathname = usePathname()
  const { update } = useSession()

  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname
  const routerRef = useRef(router)
  routerRef.current = router
  const updateRef = useRef(update)
  updateRef.current = update

  const handleAccountStatus = useCallback((payload: AccountStatusTunnelPayload) => {
    if (payload.type === 'account-suspend-notification') {
      const locale = localeFromPathname(pathnameRef.current)
      void updateRef.current().then(() => {
        routerRef.current.push(ROUTES.ACCOUNT_SUSPENDED(locale))
      })
      return
    }

    if (payload.type === 'account-reactivate-notification') {
      void updateRef.current().then(() => routerRef.current.refresh())
    }
  }, [])

  useTunnelChannel<AccountStatusTunnelPayload>({
    channel: ACCOUNT_STATUS_TUNNEL_CHANNEL,
    userScoped: false,
    onMessage: handleAccountStatus,
  })

  return null
}
