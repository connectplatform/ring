import React, { Suspense } from 'react'
import { NotificationProvider } from '@/features/notifications/components/notification-provider'
import { I18nProvider } from '@/components/providers/i18n-provider'
import Navigation from '@/components/navigation/navigation'
import { routing } from '@/i18n-config'
import { notFound, redirect } from 'next/navigation'
import { setupResourcePreloading } from '@/lib/preload/setup'
import { buildMessages } from '@/lib/i18n'
import { auth } from '@/auth'
import { UserRole } from '@/features/auth/types'
import { connection } from 'next/server'

interface AdminLocaleLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

/**
 * Next.js 16 Streaming Layout: Static shell renders instantly.
 * Auth check + children stream inside Suspense.
 */
export default async function AdminLocaleLayout({ children, params }: AdminLocaleLayoutProps) {
  const { locale } = await params
  
  // Validate locale using next-intl routing config
  if (!routing.locales.includes(locale as any)) {
    notFound()
  }
  
  setupResourcePreloading()
  const messages = await buildMessages(locale)
  
  return (
    <I18nProvider locale={locale} messages={messages}>
      <NotificationProvider>
        <div className="flex flex-col min-h-screen">
          <Navigation />
          <Suspense fallback={
            <main className="flex-grow pt-0">
              <div className="animate-pulse p-6 space-y-4">
                <div className="h-8 bg-muted rounded w-1/3"></div>
                <div className="h-64 bg-muted rounded"></div>
              </div>
            </main>
          }>
            <AdminAuthGuard locale={locale}>
              {children}
            </AdminAuthGuard>
          </Suspense>
        </div>
      </NotificationProvider>
    </I18nProvider>
  )
}

/** Auth guard - runs inside Suspense, streams after shell */
async function AdminAuthGuard({ children, locale }: { children: React.ReactNode; locale: string }) {
  await connection()
  
  const session = await auth()
  if (!session) {
    redirect(`/${locale}/login`)
  }
  
  if (session.user.role !== UserRole.ADMIN && session.user.role !== UserRole.SUPERADMIN) {
    redirect(`/${locale}/unauthorized`)
  }
  
  return <main className="flex-grow pt-0">{children}</main>
}
