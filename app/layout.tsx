import React from 'react'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { SessionProvider } from '@/components/providers/session-provider'
import { FCMProvider, FCMPermissionPrompt } from '@/components/providers/fcm-provider'
import { WebVitalsProvider } from '@/components/providers/web-vitals-provider'
import { WebSocketProvider } from '@/components/providers/websocket-provider'
import InstanceThemeStyle from '@/components/common/whitelabel/InstanceThemeStyle.server'
import { Toaster } from '@/components/ui/toaster'
import '@/styles/globals.css'
import { Inter } from 'next/font/google'
import { AppProvider } from '@/contexts/app-context'
import { getServerAuthSession } from '@/auth'
import InstanceConfigProvider from '@/components/providers/instance-config-provider'
import { StoreProvider } from '@/features/store/context'

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
  const session = await getServerAuthSession().catch(() => null)
  
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
          <WebVitalsProvider>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
              <InstanceConfigProvider>
              <AppProvider>
                <FCMProvider>
                  <WebSocketProvider>
                    <StoreProvider>
                      <div className="flex flex-col min-h-screen">
                        <main className="flex-grow">{children}</main>
                      </div>
                    </StoreProvider>
                    {/* Removed transition overlay to prevent color banding/stripes during theme switch */}
                    <FCMPermissionPrompt />
                    <Toaster />
                  </WebSocketProvider>
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