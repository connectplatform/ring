import React, { Suspense } from 'react'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { SessionAuthGuard } from '@/lib/auth/layout-guards/session-auth-guard'
import { LocaleLayoutFallback } from '@/components/layout/locale-layout-fallback'

interface StoreSettingsLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }> // `params` is a promise that resolves to an object with a `locale` property.
}

export default async function StoreSettingsLayout({ children, params }: StoreSettingsLayoutProps) {
  // Wait for params to resolve and extract the `locale` parameter.
  const { locale: localeParam } = await params

  // Check if the resolved `locale` is in the list of supported locales.
  // If valid, use it; otherwise, fallback to the default locale.
  const locale: Locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  // Render the layout:
  // - `SessionAuthGuard` wraps the content to require a valid session.
  // - `Suspense` provides a fallback UI until children or guards are ready.
  return (
    <Suspense fallback={<LocaleLayoutFallback />}>
      <SessionAuthGuard locale={locale}>
        {children}
      </SessionAuthGuard>
    </Suspense>
  )
}

// TODO: With React 19 and Next.js 16, consider using the new `use` hook to consume the `params` promise more ergonomically instead of making the layout async and using `await params`.
// TODO: The `Suspense` fallback may be unnecessary on layout boundaries or may be replaced with Next.js-specific boundary or streaming features.