import React from 'react'
import UnifiedLoginInline from '@/features/auth/components/unified-login-inline'
import { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates, type Locale } from '@/i18n-config'


/**
 * Define the specific type for login page params
 */
type LoginParams = {};

/**
 * LoginPage component for handling user authentication.
 * 
 * User steps:
 * 1. User navigates to the login page
 * 2. If the user is already authenticated, they are redirected to their profile or a specified page
 * 3. If not authenticated, the unified-login-component is rendered with options for Google, Apple, and Crypto Wallet login
 * 
 * @param props - The page properties including params and searchParams as Promises
 * @returns The rendered login page or a redirect
 */
export default async function LoginPage(props: LocalePageProps<LoginParams>) {
  // Next.js 16: Resolve params/searchParams OUTSIDE try/catch.
  // During prerendering these Promises reject with HANGING_PROMISE_REJECTION
  // when the prerender completes — React handles this automatically,
  // but a try/catch would swallow the signal and produce noisy error logs.
  const params = await props.params
  const searchParams = await props.searchParams

  // Extract and validate locale
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale

  // React 19 metadata preparation
  const t = await loadTranslations(locale)
  const title = (t as any).metadata?.login || 'Login | Ring App'
  const description = (t as any).metaDescription?.login || 'Log in to access tech opportunities in Cherkasy region'
  const canonicalUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://ring-platform.org'}/${locale}/login`
  const alternates = generateHreflangAlternates('/login')

  // Support from, callbackUrl, and returnTo for post-login redirect (standardize on 'from' internally)
  const rawFrom = searchParams.from ?? searchParams.callbackUrl ?? searchParams.returnTo
  const from = typeof rawFrom === 'string' ? rawFrom : undefined

  // Render the login form
  return (
    <>
      {/* React 19 Native Document Metadata */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      
      {/* OpenGraph metadata */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content={locale === 'uk' ? 'uk_UA' : 'en_US'} />
      <meta property="og:alternate_locale" content={locale === 'uk' ? 'en_US' : 'uk_UA'} />
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      
      {/* Hreflang alternates */}
      {Object.entries(alternates).map(([lang, url]) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={url as string} />
      ))}

      {/* Login container with sidebar offset for desktop centering */}
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 md:ml-[280px]">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">{t.pages.login.title}</h1>
            <p className="text-muted-foreground">{t.pages.login.subtitle}</p>
          </div>
          <UnifiedLoginInline from={from} variant="hero" />
        </div>
      </div>
    </>
  )
}

/* 
 * OBSOLETE FUNCTIONS (removed with React 19 migration):
 * - generateMetadata() function (replaced by React 19 native document metadata)
 * 
 * React 19 Native Features Used:
 * - Document metadata: <title>, <meta>, <link> tags automatically hoisted to <head>
 * - Automatic meta tag deduplication and precedence handling
 * - Native hreflang support for i18n
 */