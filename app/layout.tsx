import React from 'react'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { SessionProvider } from '@/components/providers/session-provider'
import { I18nProvider } from '@/components/providers/i18n-provider'
import { FCMProvider, FCMPermissionPrompt } from '@/components/providers/fcm-provider'
import Navigation from '@/features/layout/components/navigation'
import Footer from '@/features/layout/components/footer'
import { Toaster } from '@/components/ui/toaster'
import '@/styles/globals.css'
import { Inter } from 'next/font/google'
import { Metadata } from 'next'
import { AppProvider } from '@/contexts/app-context'
import { getServerAuthSession } from '@/auth'

// React 19 Resource Preloading APIs
import { prefetchDNS, preconnect, preload, preinit } from 'react-dom'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Ring - Decentralized Opportunities Platform',
  description: 'Connect, collaborate, and create value in the decentralized economy',
}

/**
 * React 19 Resource Preloading
 * Preload critical assets for better performance
 */
function PreloadResources() {
  return (
    <>
      {/* Preload critical fonts */}
      <link
        rel="preload"
        href="/fonts/inter-var.woff2"
        as="font"
        type="font/woff2"
        crossOrigin="anonymous"
      />
      
      {/* Preload critical images */}
      <link
        rel="preload"
        href="/images/logo.svg"
        as="image"
        type="image/svg+xml"
      />
      
      {/* Preload critical CSS */}
      <link
        rel="preload"
        href="/styles/globals.css"
        as="style"
      />
      
      {/* DNS prefetch for external resources */}
      <link rel="dns-prefetch" href="//fonts.googleapis.com" />
      <link rel="dns-prefetch" href="//fonts.gstatic.com" />
      
      {/* Preconnect to critical origins */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      
      {/* Module preload for critical JavaScript */}
      <link
        rel="modulepreload"
        href="/_next/static/chunks/main.js"
      />
      <link
        rel="modulepreload"
        href="/_next/static/chunks/webpack.js"
      />
    </>
  )
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // React 19 Resource Preloading - Critical Performance Optimization
  
  // DNS prefetching for external domains
  prefetchDNS('https://fonts.googleapis.com')
  prefetchDNS('https://fonts.gstatic.com')
  prefetchDNS('https://api.ring.platform')
  prefetchDNS('https://firebaseapp.com')
  prefetchDNS('https://googleapis.com')
  
  // Preconnect to critical resources with crossOrigin
  preconnect('https://fonts.gstatic.com', { crossOrigin: 'anonymous' })
  preconnect('https://fonts.googleapis.com', { crossOrigin: 'anonymous' })
  
  // Preload critical fonts
  preload('/fonts/inter-var.woff2', { 
    as: 'font', 
    type: 'font/woff2', 
    crossOrigin: 'anonymous' 
  })
  
  // Preload critical images
  preload('/images/logo.svg', { as: 'image' })
  preload('/images/hero-banner.webp', { as: 'image' })
  preload('/placeholder.svg', { as: 'image' })
  
  // Preinit critical scripts for better performance
  preinit('/scripts/analytics.js', { as: 'script' })
  
  // Get server session to pass to SessionProvider
  const session = await getServerAuthSession().catch(() => null)
  
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <PreloadResources />
        
        {/* React 19 Enhanced Meta Tags */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#000000" />
        <meta name="color-scheme" content="light dark" />
        
        {/* Performance hints */}
        <meta httpEquiv="x-dns-prefetch-control" content="on" />
        
        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />
        
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="font-inter antialiased">
        <SessionProvider session={session}>
          <I18nProvider>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
              <AppProvider>
                <FCMProvider>
                  <div className="flex flex-col min-h-screen">
                    <Navigation />
                    <main className="flex-grow pt-16">{children}</main>
                    <Footer />
                  </div>
                  <div className="theme-transition-bg" aria-hidden="true" />
                  <FCMPermissionPrompt />
                  <Toaster />
                </FCMProvider>
              </AppProvider>
            </ThemeProvider>
          </I18nProvider>
        </SessionProvider>
      </body>
    </html>
  )
}