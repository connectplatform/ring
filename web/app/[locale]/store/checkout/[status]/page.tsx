import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import React from 'react'
import { SUPPORTED_LOCALES, type Locale } from '@/lib/locale-config'
import CheckoutStatusPage from '@/components/store/checkout-status-page'
import { isValidLocale, defaultLocale } from '@/i18n/shared'
import { notFound } from 'next/navigation'

// List of valid checkout status types
const VALID_STATUSES = [
  'success',
  'failure', 
  'cancel',
  'error',
  'pending',
  'processing',
  'complete'
] as const

// Define CheckoutStatus type as one of the valid status strings
type CheckoutStatus = typeof VALID_STATUSES[number]

// Builds SEO metadata for the checkout status page
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; status: string }>
}): Promise<Metadata> {
  // Awaiting params since Next passes params as a Promise
  // TODO: Next.js 16 (App Router) may natively pass params as object, not a Promise in page.js - check and refactor if possible.
  const { locale: localeParam, status } = await params

  // Validate and normalize locale
  // Prefer params locale if it's in the routing locales, otherwise use default
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  // Set the current request locale (for SSR translation)
  setRequestLocale(locale)
  
  // Construct and return localized SEO metadata for the page
  return buildLocalizedMetadata({
    locale,
    path: 'store.checkout.status',
    variables: { status: status.charAt(0).toUpperCase() + status.slice(1) },
    pathname: '/store/checkout',
  })
}

// Page component for displaying the checkout status screen
export default async function CheckoutStatusDynamicPage({ 
  params 
}: { 
  params: Promise<{ locale: Locale; status: string }> 
}) {
  // Awaiting params - see TODO in generateMetadata, this might become direct object destructure
  const { locale, status } = await params

  // Validate the provided status parameter; notFound() triggers a 404 page if invalid
  if (!VALID_STATUSES.includes(status as CheckoutStatus)) {
    notFound()
  }

  // Ensure locale is valid, fallback to defaultLocale if not
  const validLocale = isValidLocale(locale) ? locale : defaultLocale

  // Render the status page component with appropriate locale and status
  return (
      <CheckoutStatusPage 
        status={status as CheckoutStatus}
        locale={validLocale}
      />
  )
}

// Generate all static params combinations for pre-rendering
export async function generateStaticParams() {
  const params = []
  // For each supported locale and valid status, create a params object
  for (const locale of SUPPORTED_LOCALES) {
    for (const status of VALID_STATUSES) {
      params.push({ locale, status })
    }
  }
  return params
  // TODO: If SUPPORTED_LOCALES or VALID_STATUSES can be very large, consider optimizing for build speed/memory.
}
