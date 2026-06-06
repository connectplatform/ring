'use client'

import React from 'react'
import { SessionProvider } from '@/features/auth/components/session-provider'
import { CreditBalanceProvider } from '@/components/providers/credit-balance-provider'
import { Web3ScopeProvider } from '@/components/providers/web3-scope-provider'
import { WebVitalsProvider } from '@/components/providers/web-vitals-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import InstanceConfigProvider from '@/components/providers/instance-config-provider'
import { AppProvider } from '@/contexts/app-context'
import { FCMProvider, FCMPermissionPrompt } from '@/components/providers/fcm-provider'
import { TunnelProvider } from '@/components/providers/tunnel-provider'
import { CurrencyProvider } from '@/features/store/currency-context'
import { StoreProvider } from '@/features/store/context'
import GoogleOneTap from '@/features/auth/components/google-one-tap'
import { Toaster } from '@/components/ui/toaster'

/** Minimal shell for cacheComponents static prerender (root Suspense fallback). */
export function AppShellStaticFallback({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <InstanceConfigProvider>{children}</InstanceConfigProvider>
    </ThemeProvider>
  )
}

/** Full client chrome after hydration (session, tunnel, wagmi, FCM). */
export function AppClientShell({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CreditBalanceProvider>
        <WebVitalsProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <InstanceConfigProvider>
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
            </InstanceConfigProvider>
          </ThemeProvider>
        </WebVitalsProvider>
      </CreditBalanceProvider>
    </SessionProvider>
  )
}
