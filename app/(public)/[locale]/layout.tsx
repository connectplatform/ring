import React from 'react'
import { NotificationProvider } from '@/features/notifications/components/notification-provider'
import { I18nProvider } from '@/components/providers/i18n-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import Navigation from '@/components/navigation/navigation'
import Footer from '@/features/layout/components/footer'
import { routing } from '@/i18n-config'
import { notFound } from 'next/navigation'
import { setupResourcePreloading } from '@/lib/preload/setup'
import { buildMessages } from '@/lib/i18n'

interface LocaleLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params
  
  // Validate locale using next-intl routing config
  if (!routing.locales.includes(locale as any)) {
    notFound()
  }
  
  setupResourcePreloading()
  
  // Load modular messages for the locale
  const messages = await buildMessages(locale)
  
  return (
    <I18nProvider locale={locale} messages={messages} key={`i18n-${locale}`}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <NotificationProvider>
          <div className="flex flex-col min-h-screen">
            <Navigation key={`nav-${locale}`} />
            <main className="flex-grow">{children}</main>
            <Footer key={`footer-${locale}`} />
          </div>
        </NotificationProvider>
      </ThemeProvider>
    </I18nProvider>
  )
}