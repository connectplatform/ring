import React, { Suspense } from 'react'
import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { supportedLocales } from '@/i18n/shared'
import { setupResourcePreloading } from '@/lib/preload/setup'
import { pathnameWithoutLocale } from '@/lib/seo-metadata'
import { buildMessages } from '@/lib/i18n'
import { LocaleAppChrome } from '@/components/layout/locale-app-chrome'
import { LocaleLayoutFallback } from '@/components/layout/locale-layout-fallback'

interface LocaleLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export function generateStaticParams() {
  return supportedLocales.map((locale) => ({ locale }))
}

/**
 * Unified locale layout — single chrome for all routes.
 * Sync shell → Suspense → async inner resolves params/messages (Next 16 pattern).
 */
export default function LocaleLayout({ children, params }: LocaleLayoutProps) {
  return (
    <Suspense fallback={<LocaleLayoutFallback />}>
      <LocaleLayoutInner params={params}>{children}</LocaleLayoutInner>
    </Suspense>
  )
}

async function LocaleLayoutInner({
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
  setupResourcePreloading()

  // Full corpus: unified shell persists across public/authenticated/admin nav;
  // scoped bundles from getRequestConfig do not refresh on client segment changes.
  const messages = await buildMessages(validLocale, 'full')
  const headersList = await headers()
  const hreflangPath = pathnameWithoutLocale(headersList.get('x-pathname') ?? '/')

  return (
    <LocaleAppChrome locale={validLocale} messages={messages} hreflangPath={hreflangPath}>
      {children}
    </LocaleAppChrome>
  )
}
