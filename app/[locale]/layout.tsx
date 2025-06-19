import React from 'react'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { SessionProvider } from '@/components/providers/session-provider'
import { I18nProvider } from '@/components/providers/i18n-provider'
import { NotificationProvider } from '@/components/notifications/notification-provider'

import '@/styles/globals.css'
import { Inter } from 'next/font/google'
import { AppProvider } from '@/contexts/app-context'
import { auth } from '@/auth'
import { isValidLocale, defaultLocale, Locale } from '@/utils/i18n-server'
import { notFound } from 'next/navigation'

// React 19 Resource Preloading APIs
import { prefetchDNS, preconnect, preload, preinit } from 'react-dom'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

interface LocaleLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function LocaleLayout({
  children,
  params
}: LocaleLayoutProps) {
  // Await params before destructuring
  const { locale } = await params
  
  // Validate locale
  if (!isValidLocale(locale)) {
    notFound()
  }

  // React 19 Resource Preloading - Locale-specific Performance Optimization
  
  // DNS prefetching for locale-specific resources
  prefetchDNS('https://fonts.googleapis.com')
  prefetchDNS('https://fonts.gstatic.com')
  prefetchDNS('https://api.ring.platform')
  prefetchDNS('https://cdn.ring.platform')
  
  // Preconnect to critical resources
  preconnect('https://fonts.gstatic.com', { crossOrigin: 'anonymous' })
  preconnect('https://api.ring.platform')
  
  // Preload locale-specific assets
  preload(`/locales/${locale}/common.json`, { as: 'fetch', crossOrigin: 'anonymous' })
  preload(`/locales/${locale}/navigation.json`, { as: 'fetch', crossOrigin: 'anonymous' })
  
  // Preload critical fonts for the locale
  preload('/fonts/inter-var.woff2', { 
    as: 'font', 
    type: 'font/woff2', 
    crossOrigin: 'anonymous' 
  })
  
  // Preload critical images
  preload('/images/logo.svg', { as: 'image' })
  preload('/placeholder.svg', { as: 'image' })
  
  // Preload locale-specific stylesheets if they exist
  if (locale === 'uk') {
    preload('/styles/locale-uk.css', { as: 'style' })
  }
  
  // Preinit analytics and tracking scripts
  preinit('/scripts/analytics.js', { as: 'script' })
  preinit('/scripts/locale-tracking.js', { as: 'script' })

  // Get server session using Auth.js v5 universal auth() method
  const session = await auth().catch(() => null)

  return (
    <html lang={locale} suppressHydrationWarning className={inter.variable}>
      <body className="font-inter antialiased">
        <SessionProvider session={session}>
          <I18nProvider locale={locale}>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
              <AppProvider>
                <NotificationProvider>
                  <div className="flex flex-col min-h-screen">
                    <main className="flex-grow">{children}</main>
                  </div>
                  <div className="theme-transition-bg" aria-hidden="true" />
                </NotificationProvider>
              </AppProvider>
            </ThemeProvider>
          </I18nProvider>
        </SessionProvider>
      </body>
    </html>
  )
} 