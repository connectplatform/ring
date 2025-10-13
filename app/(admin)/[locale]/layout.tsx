import React from 'react'
import { NotificationProvider } from '@/features/notifications/components/notification-provider'
import { I18nProvider } from '@/components/providers/i18n-provider'
import Navigation from '@/features/layout/components/navigation'
import Footer from '@/features/layout/components/footer'
import { routing } from '@/i18n-config'
import { notFound, redirect } from 'next/navigation'
import { setupResourcePreloading } from '@/lib/preload/setup'
import { buildMessages } from '@/lib/i18n'
import { auth } from '@/auth'
import { UserRole } from '@/features/auth/types'

interface AdminLocaleLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function AdminLocaleLayout({ children, params }: AdminLocaleLayoutProps) {
  const { locale } = await params
  
  // Validate locale using next-intl routing config
  if (!routing.locales.includes(locale as any)) {
    notFound()
  }
  
  // Check authentication and admin role
  const session = await auth()
  if (!session) {
    redirect(`/${locale}/login`)
  }
  
  // Check if user has admin or superadmin role
  if (session.user.role !== UserRole.ADMIN && session.user.role !== UserRole.SUPERADMIN) {
    redirect(`/${locale}/unauthorized`)
  }
  
  setupResourcePreloading()
  
  // Load modular messages for the locale
  const messages = await buildMessages(locale)
  
  return (
    <I18nProvider locale={locale} messages={messages}>
      <NotificationProvider>
        <div className="flex flex-col min-h-screen">
          <Navigation />
          <main className="flex-grow pt-16">{children}</main>
        </div>
      </NotificationProvider>
    </I18nProvider>
  )
}
