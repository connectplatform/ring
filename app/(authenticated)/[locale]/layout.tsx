import React, { Suspense } from 'react'
import { setRequestLocale } from 'next-intl/server'
import { NotificationProvider } from '@/features/notifications/components/notification-provider'
import { I18nProvider } from '@/components/providers/i18n-provider'
import Navigation from '@/components/navigation/navigation'
import type { Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { notFound } from 'next/navigation'
import { localizedRedirect } from '@/lib/i18n-server-redirect'
import { setupResourcePreloading } from '@/lib/preload/setup'
import { getMessages } from 'next-intl/server'
import { auth } from '@/auth'
import { connection } from 'next/server'
import { AppContentShell } from '@/components/layout/ring-app-shell'

interface AuthenticatedLocaleLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

/**
 * Next.js 16 Streaming Layout: Static shell renders instantly.
 * Auth check + children stream inside Suspense.
 */
export default async function AuthenticatedLocaleLayout({ children, params }: AuthenticatedLocaleLayoutProps) {
  const { locale } = await params
  
  // Validate locale using next-intl routing config
  if (!routing.locales.includes(locale as Locale)) {
    notFound()
  }
  const validLocale: Locale = locale as Locale
  setRequestLocale(validLocale)

  setupResourcePreloading()
  const messages = await getMessages()
  
  return (
    <I18nProvider locale={validLocale} messages={messages}>
      <NotificationProvider>
        <div className="flex flex-col min-h-screen">
          <Navigation />
          <Suspense fallback={
            <main className="flex-grow md:pl-(--sidebar-total-w)">
              <div className="animate-pulse p-6 space-y-4">
                <div className="h-8 bg-muted rounded w-1/3"></div>
                <div className="h-64 bg-muted rounded"></div>
              </div>
            </main>
          }>
            <AuthGuard locale={validLocale}>
              {children}
            </AuthGuard>
          </Suspense>
        </div>
      </NotificationProvider>
    </I18nProvider>
  )
}

/** Auth guard - runs inside Suspense, streams after shell */
async function AuthGuard({ children, locale }: { children: React.ReactNode; locale: Locale }) {
  await connection()
  
  const session = await auth()
  if (!session) {
    localizedRedirect({ locale, href: '/login' })
  }
  
  return (
    <main className="flex-grow md:pl-(--sidebar-total-w)">
      <AppContentShell>{children}</AppContentShell>
    </main>
  )
}
