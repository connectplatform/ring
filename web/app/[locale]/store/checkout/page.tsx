import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import React from 'react'
import type { Locale } from '@/i18n/shared'
import CheckoutWrapper from '@/components/wrappers/checkout-wrapper'
import CheckoutClient from './checkout-client'
import { isValidLocale, defaultLocale } from '@/i18n/shared'

// TODO: Consider using the new Next.js 16 route segment config to strongly type locales at the filesystem-level, if possible.

/**
 * Generates the page metadata for the checkout page, using the locale provided in route params.
 * - Confirms the passed locale is valid from the routing config. 
 * - Sets the correct request locale for SSR.
 * - Returns SEO metadata appropriate to the locale and path.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  // Wait for the params, and extract the locale param from the promise.
  // TODO: In Next.js 16, consider using "params: { locale: string }" directly if params are always sync (reduce cognitive load).
  const { locale: localeParam } = await params
  // Validate locale: If not in supported list, use default locale.
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  // Set the request's locale for downstream intl features (server side).
  setRequestLocale(locale)
  // Build and return the SEO metadata for this page.
  return buildLocalizedMetadata({
    locale,
    path: 'store.checkout',
    variables: {},
    pathname: '/store/checkout',
  }) as Metadata
}

/**
 * The Checkout page component.
 * - Receives the "locale" param (async for edge compatibility).
 * - Validates locale; falls back to default locale if invalid.
 * - Renders the checkout wrapper and client components with effective locale.
 */
export default async function CheckoutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  // TODO: Use synchronous params if supported in your Next version. Using async params in the page is often unnecessary for static params.
  const { locale } = await params
  // Ensure the locale is valid, otherwise use default (prevents bad route param from breaking page).
  const validLocale = isValidLocale(locale) ? locale : defaultLocale

  return (
    <CheckoutWrapper locale={validLocale}>
      {/* Passing both locale as prop and as key to force proper re-render if locale changes */}
      <CheckoutClient key={locale} locale={locale} />
    </CheckoutWrapper>
  )
}
