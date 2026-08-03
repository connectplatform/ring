'use client'

import React, { Suspense } from 'react'
import type { Session } from 'next-auth'
import { SessionProvider } from '@/features/auth/components/session-provider'
import { CreditBalanceProvider } from '@/components/providers/credit-balance-provider'
import { Web3ScopeProvider } from '@/components/providers/web3-scope-provider'
import { WebVitalsProvider } from '@/components/providers/web-vitals-provider'
import { DeviceTelemetryProvider } from '@/components/providers/device-telemetry-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import {
  InstanceConfigClientProvider,
  type PublicInstanceConfig,
} from '@/components/common/whitelabel/instance-config-client'
import { getPublicInstanceConfigFromSnapshot } from '@/lib/ring-config-core'
import { AppProvider } from '@/contexts/app-context'
import { FCMProvider, FCMPermissionPrompt } from '@/components/providers/fcm-provider'
import { TunnelProvider } from '@/components/providers/tunnel-provider'
import { GlobalTunnelListeners } from '@/components/providers/global-tunnel-listeners'
import { StorePaymentMethodsProvider } from '@/features/store/currency-context'
import { StoreProvider } from '@/features/store/context'
import GoogleOneTap from '@/features/auth/components/google-one-tap'
import { Toaster } from '@/components/ui/toaster'
import { RingAnalyticsBeacon } from '@/components/providers/ring-analytics-beacon'
import { MediaUseTargetProvider } from '@/features/generative-media/media-use-target'

/** Static whitelabel defaults for Suspense fallback — from ring-config snapshot. */
const APP_SHELL_STATIC_INSTANCE_CONFIG: PublicInstanceConfig =
  getPublicInstanceConfigFromSnapshot()

/** Minimal shell for cacheComponents static prerender (root Suspense fallback). Must not render route children. */
export function AppShellStaticFallback() {
  return (
    <ThemeProvider>
      <InstanceConfigClientProvider value={APP_SHELL_STATIC_INSTANCE_CONFIG}>
        <div className="min-h-screen animate-pulse bg-muted/20" aria-hidden="true" />
      </InstanceConfigClientProvider>
    </ThemeProvider>
  )
}

/** Full client chrome after hydration (session, tunnel, wagmi, FCM). */
export function AppClientShell({
  instanceConfig,
  session = null,
  children,
}: {
  instanceConfig: PublicInstanceConfig
  /** SSR session from root layout — prevents loading→unauthenticated flash on protected forms. */
  session?: Session | null
  children: React.ReactNode
}) {
  return (
    <SessionProvider session={session}>
      <WebVitalsProvider>
        <DeviceTelemetryProvider>
          <ThemeProvider>
            <InstanceConfigClientProvider value={instanceConfig}>
              <AppProvider>
                <MediaUseTargetProvider>
                <FCMProvider>
                  <TunnelProvider autoConnect={false} debug={false}>
                    <CreditBalanceProvider>
                      <GlobalTunnelListeners />
                      <Web3ScopeProvider>
                        <StorePaymentMethodsProvider>
                          <StoreProvider>
                            {children}
                            <GoogleOneTap />
                            <Suspense fallback={null}>
                              <RingAnalyticsBeacon />
                            </Suspense>
                          </StoreProvider>
                        </StorePaymentMethodsProvider>
                      </Web3ScopeProvider>
                    </CreditBalanceProvider>
                    <FCMPermissionPrompt />
                    <Toaster />
                  </TunnelProvider>
                </FCMProvider>
                </MediaUseTargetProvider>
              </AppProvider>
            </InstanceConfigClientProvider>
          </ThemeProvider>
        </DeviceTelemetryProvider>
      </WebVitalsProvider>
    </SessionProvider>
  )
}
