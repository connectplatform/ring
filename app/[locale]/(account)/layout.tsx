import React, { Suspense } from 'react'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { SuspendedAccountGuard } from '@/lib/auth/layout-guards/suspended-account-guard'
import { LocaleLayoutFallback } from '@/components/layout/locale-layout-fallback'

interface AccountLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

/**
 * Minimal shell for suspended-account flows — paired with LocaleAppChrome variant="minimal".
 */
export default async function AccountLayout({ children, params }: AccountLayoutProps) {
  const { locale: localeParam } = await params
  const locale: Locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  return (
    <Suspense fallback={<LocaleLayoutFallback />}>
      <SuspendedAccountGuard locale={locale}>{children}</SuspendedAccountGuard>
    </Suspense>
  )
}
