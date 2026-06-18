import React, { Suspense } from 'react'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { SessionAuthGuard } from '@/lib/auth/layout-guards/session-auth-guard'
import { LocaleLayoutFallback } from '@/components/layout/locale-layout-fallback'

interface StoreSettingsLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function StoreSettingsLayout({ children, params }: StoreSettingsLayoutProps) {
  const { locale: localeParam } = await params
  const locale: Locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  return (
    <Suspense fallback={<LocaleLayoutFallback />}>
      <SessionAuthGuard locale={locale}>{children}</SessionAuthGuard>
    </Suspense>
  )
}
