import React from 'react'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { SessionProvider } from '@/features/auth/components/session-provider'
import { FCMProvider, FCMPermissionPrompt } from '@/components/providers/fcm-provider'
import { WebVitalsProvider } from '@/components/providers/web-vitals-provider'
import { TunnelProvider } from '@/components/providers/tunnel-provider'
import InstanceThemeStyle from '@/components/common/whitelabel/InstanceThemeStyle.server'
import { Toaster } from '@/components/ui/toaster'
import '@/styles/globals.css'
import { Inter } from 'next/font/google'
import { AppProvider } from '@/contexts/app-context'
import { auth } from '@/auth'
import InstanceConfigProvider from '@/components/providers/instance-config-provider'
import { StoreProvider } from '@/features/store/context'
import { WebSocketDiagnosticsProvider } from '@/components/providers/websocket-diagnostics-provider'
import PortalNavigation from '@/components/portal/portal-navigation'

// Suppress known third-party library warnings
import '@/lib/suppress-warnings'

// React 19 Resource Preloading APIs
import { setupResourcePreloading } from '@/lib/preload/setup'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

// Root layout doesn't need page-specific metadata
// Each page will provide its own using React 19 native metadata

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // React 19 Resource Preloading - Critical Performance Optimization
  setupResourcePreloading()
  
  // Get server session to pass to SessionProvider
  const session = await auth().catch(() => null)
  
  console.log('🟠 Root Layout: Session from server:', session ? { id: session.user?.id, email: session.user?.email, name: session.user?.name } : 'null')

  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <InstanceThemeStyle />

        {/* React 19 Enhanced Meta Tags */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#000000" />
        <meta name="color-scheme" content="light dark" />

        {/* Performance hints */}
        <meta httpEquiv="x-dns-prefetch-control" content="on" />

        {/* PWA manifest - uncomment when manifest.json is created */}
        {/* <link rel="manifest" href="/manifest.json" /> */}

        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="font-inter antialiased">
      <SessionProvider session={session}>
          {/* Debug overlay */}
          <div style={{
            position: 'fixed',
            top: '5px',
            left: '5px',
            background: 'rgba(255,0,0,0.8)',
            color: 'white',
            padding: '5px',
            borderRadius: '4px',
            fontSize: '11px',
            zIndex: 10000,
            maxWidth: '300px'
          }}>
            Debug: Session: {session ? 'YES' : 'NO'}
            {session && ` | User: ${session.user?.name || session.user?.email || session.user?.id || 'unknown'}`}
          </div>

          <WebVitalsProvider>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
              <InstanceConfigProvider>
              <AppProvider>
                <FCMProvider>
                  <TunnelProvider autoConnect={true} debug={false}>
                    <StoreProvider>
                      <div className="flex flex-col min-h-screen">
                        <PortalNavigation />
                        <main className="flex-grow">{children}</main>
                      </div>
                    </StoreProvider>
                    {/* Removed transition overlay to prevent color banding/stripes during theme switch */}
                    <FCMPermissionPrompt />
                    <Toaster />
                    {/* WebSocket Diagnostics Panel (Development Only) */}
                    <WebSocketDiagnosticsProvider />
                  </TunnelProvider>
                </FCMProvider>
              </AppProvider>
              </InstanceConfigProvider>
            </ThemeProvider>
          </WebVitalsProvider>
          </SessionProvider>
      </body>
    </html>
  )
}