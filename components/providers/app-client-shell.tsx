'use client'

import React from 'react'
import { SessionProvider } from '@/features/auth/components/session-provider'
import { CreditBalanceProvider } from '@/components/providers/credit-balance-provider'
import { Web3ScopeProvider } from '@/components/providers/web3-scope-provider'
import { WebVitalsProvider } from '@/components/providers/web-vitals-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import {
  InstanceConfigClientProvider,
  type PublicInstanceConfig,
} from '@/components/common/whitelabel/instance-config-client'
import { getPublicInstanceConfigFromSnapshot } from '@/lib/ring-config-core'
import { AppProvider } from '@/contexts/app-context'
import { FCMProvider, FCMPermissionPrompt } from '@/components/providers/fcm-provider'
import { TunnelProvider } from '@/components/providers/tunnel-provider'
import { CurrencyProvider } from '@/features/store/currency-context'
import { StoreProvider } from '@/features/store/context'
import GoogleOneTap from '@/features/auth/components/google-one-tap'
import { Toaster } from '@/components/ui/toaster'

/** Static whitelabel defaults for Suspense fallback — from ring-config snapshot. */
const APP_SHELL_STATIC_INSTANCE_CONFIG: PublicInstanceConfig =
  getPublicInstanceConfigFromSnapshot()

/** Minimal shell for cacheComponents static prerender (root Suspense fallback). Must not render route children. */
export function AppShellStaticFallback() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <InstanceConfigClientProvider value={APP_SHELL_STATIC_INSTANCE_CONFIG}>
        <div className="min-h-screen animate-pulse bg-muted/20" aria-hidden="true" />
      </InstanceConfigClientProvider>
    </ThemeProvider>
  )
}

/** Full client chrome after hydration (session, tunnel, wagmi, FCM). */
export function AppClientShell({
  instanceConfig,
  children,
}: {
  instanceConfig: PublicInstanceConfig
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <CreditBalanceProvider>
        <WebVitalsProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <InstanceConfigClientProvider value={instanceConfig}>
              <AppProvider>
                <FCMProvider>
                  <TunnelProvider autoConnect={false} debug={false}>
                    <Web3ScopeProvider>
                      <CurrencyProvider>
                        <StoreProvider>
                          {children}
                          <GoogleOneTap />
                        </StoreProvider>
                      </CurrencyProvider>
                    </Web3ScopeProvider>
                    <FCMPermissionPrompt />
                    <Toaster />
                  </TunnelProvider>
                </FCMProvider>
              </AppProvider>
            </InstanceConfigClientProvider>
          </ThemeProvider>
        </WebVitalsProvider>
      </CreditBalanceProvider>
    </SessionProvider>
  )
}
