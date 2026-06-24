'use client'

import { AccountStatusTunnelListener } from '@/components/providers/account-status-tunnel-listener'

/**
 * Single mount point for per-user global tunnel side-effects (Path A under TunnelProvider).
 * Add future listeners here — do not mount siblings directly in AppClientShell.
 */
export function GlobalTunnelListeners() {
  return (
    <>
      <AccountStatusTunnelListener />
    </>
  )
}
