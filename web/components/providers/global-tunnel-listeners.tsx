'use client'

import { Suspense } from 'react'
import { AccountStatusTunnelListener } from '@/components/providers/account-status-tunnel-listener'
import { GlobalIncomingCallBanner } from '@/features/chat/components/global-incoming-call-banner'
import { GlobalIncomingGameBanner } from '@/features/peer-games/components/global-incoming-game-banner'

/**
 * Single mount point for per-user global tunnel side-effects (Path A under TunnelProvider).
 * Add future listeners here — do not mount siblings directly in AppClientShell.
 */
export function GlobalTunnelListeners() {
  return (
    <>
      <AccountStatusTunnelListener />
      <Suspense fallback={null}>
        <GlobalIncomingCallBanner />
      </Suspense>
      <GlobalIncomingGameBanner />
    </>
  )
}
