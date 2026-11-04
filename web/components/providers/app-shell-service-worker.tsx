'use client'

import { useEffect } from 'react'
import { isIosDevice } from '@/lib/browser/pwa-display'
import { registerAppShellServiceWorker } from '@/lib/notifications/register-app-shell-sw'

/** Chromium only. Does not ask for notification permission. */
export function AppShellServiceWorker() {
  useEffect(() => {
    if (isIosDevice()) return
    void registerAppShellServiceWorker()
  }, [])
  return null
}
