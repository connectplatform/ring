import React, { Suspense } from 'react'
import { setRequestLocale } from 'next-intl/server'
import { NotificationProvider } from '@/features/notifications/components/notification-provider'
import { I18nProvider } from '@/components/providers/i18n-provider'
import Navigation from '@/components/navigation/navigation'
import type { Locale } from '@/i18n/shared'
import { supportedLocales } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { notFound } from 'next/navigation'
import { getMessages } from 'next-intl/server'
import { headers } from 'next/headers'
import { HreflangLinks } from '@/components/seo/hreflang-links'
import { AppContentShell } from '@/components/layout/ring-app-shell'
import { ReferralAttributionEffect } from '@/components/refcodes/referral-attribution-effect'
import { pathnameWithoutLocale } from '@/lib/seo-metadata'

interface LocaleLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

/** Predeclare locale param values so pages may await `params` / use `getTranslations` during prerender. */
export function generateStaticParams() {
  return supportedLocales.map((locale) => ({ locale }))
}

function PublicLocaleLayoutFallback() {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="h-14 border-b bg-muted/30 animate-pulse" aria-hidden />
      <main className="flex-grow md:pl-(--sidebar-total-w)">
        <div className="container max-w-6xl mx-auto px-4 py-16 animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-2/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </main>
    </div>
  )
}

/**
 * Next.js 16 + cacheComponents: layout must not `await params` before Suspense (blocking-route).
 * Sync shell → Suspense → inner async resolves params, messages, and page tree.
 */
export default function LocaleLayout({ children, params }: LocaleLayoutProps) {
  return (
    <Suspense fallback={<PublicLocaleLayoutFallback />}>
      <PublicLocaleLayoutInner params={params}>{children}</PublicLocaleLayoutInner>
    </Suspense>
  )
}

async function PublicLocaleLayoutInner({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  if (!routing.locales.includes(locale as Locale)) {
    notFound()
  }
  const validLocale = locale as Locale
  setRequestLocale(validLocale)

  const messages = await getMessages()
  const headersList = await headers()
  const hreflangPath = pathnameWithoutLocale(headersList.get('x-pathname') ?? '/')

  return (
    <I18nProvider locale={validLocale} messages={messages}>
      <HreflangLinks pathname={hreflangPath} />
      <NotificationProvider>
        <ReferralAttributionEffect />
        <div className="flex flex-col min-h-screen">
          <Navigation key={`nav-${validLocale}`} />
          <main className="flex-grow md:pl-(--sidebar-total-w)">
            <AppContentShell>{children}</AppContentShell>
          </main>
        </div>
      </NotificationProvider>
    </I18nProvider>
  )
}
