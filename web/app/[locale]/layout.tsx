import React, { Suspense } from 'react'
import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { supportedLocales } from '@/i18n/shared'
import { setupResourcePreloading } from '@/lib/preload/setup'
import { pathnameWithoutLocale } from '@/lib/seo-metadata'
import { isLoginPath } from '@/lib/pathname-without-locale'
import { buildMessages } from '@/lib/i18n'
import { LocaleAppChrome } from '@/components/layout/locale-app-chrome'
import { LocaleLayoutFallback } from '@/components/layout/locale-layout-fallback'

// Props for the LocaleLayout component; children to render and async Next.js params
interface LocaleLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

// Generate static params for all supported locales for build-time routing
export function generateStaticParams() {
  return supportedLocales.map((locale) => ({ locale }))
}

/**
 * Unified locale layout — single chrome for all routes.
 * Synchronous shell containing a Suspense boundary for async locale/message resolution.
 */
export default function LocaleLayout({ children, params }: LocaleLayoutProps) {
  // Outer Suspense provides fallback UI while LocaleLayoutInner awaits params/messages
  return (
    <Suspense fallback={<LocaleLayoutFallback />}>
      <LocaleLayoutInner params={params}>{children}</LocaleLayoutInner>
    </Suspense>
  )
}

// Main async inner layout responsible for loading locale data and messages
async function LocaleLayoutInner({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  // Await Next.js route params, which include the parsed locale from the URL
  const { locale } = await params

  // Guard: Ensure requested locale is supported
  if (!routing.locales.includes(locale as Locale)) {
    notFound() // Triggers Next.js 404 logic for unsupported locales
  }

  const validLocale = locale as Locale

  // Register the request's active locale for downstream i18n logic
  setRequestLocale(validLocale)

  const headersList = await headers()
  const hreflangPath = pathnameWithoutLocale(headersList.get('x-pathname') ?? '/')
  const isLoginShell = isLoginPath(hreflangPath)

  if (!isLoginShell) {
    setupResourcePreloading()
  }

  // Login stays on a small bundle (pages + auth). Other routes keep the full corpus
  // so client navigations do not refetch messages.
  const messages = await buildMessages(validLocale, isLoginShell ? 'auth' : 'full')

  // Determine if user is in the /account section; set shell variant accordingly
  const isAccountShell =
    hreflangPath === '/account/suspended' || hreflangPath.startsWith('/account/')

  // Render app chrome, passing locale, loaded messages, non-localized path, and shell variant
  return (
    <LocaleAppChrome
      locale={validLocale}
      messages={messages}
      hreflangPath={hreflangPath}
      variant={isLoginShell ? 'login' : isAccountShell ? 'minimal' : 'full'}
    >
      {children}
    </LocaleAppChrome>
  )
}