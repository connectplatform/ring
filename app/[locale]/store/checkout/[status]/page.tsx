import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import React from 'react'
import { SUPPORTED_LOCALES, type Locale } from '@/lib/locale-config'
import CheckoutStatusPage from '@/components/store/checkout-status-page'
import { isValidLocale, defaultLocale } from '@/i18n/shared'
import { notFound } from 'next/navigation'

// Valid checkout status types
const VALID_STATUSES = [
  'success',
  'failure', 
  'cancel',
  'error',
  'pending',
  'processing',
  'complete'
] as const

type CheckoutStatus = typeof VALID_STATUSES[number]


export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; status: string }>
}): Promise<Metadata> {
  const { locale: localeParam, status } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'store.checkout.status',
    variables: { status: status.charAt(0).toUpperCase() + status.slice(1) },
    pathname: '/store/checkout',
    siteName: 'Ring Platform',
    twitterSite: '@RingPlatform',
  })
}

export default async function CheckoutStatusDynamicPage({ 
  params 
}: { 
  params: Promise<{ locale: Locale; status: string }> 
}) {
  const { locale, status } = await params
  
  // Validate status parameter
  if (!VALID_STATUSES.includes(status as CheckoutStatus)) {
    notFound()
  }
  
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  
  return (
      <CheckoutStatusPage 
        status={status as CheckoutStatus}
        locale={validLocale}
      />
  )
}

// Generate static params for all valid checkout statuses
export async function generateStaticParams() {
  const params = []
  
  for (const locale of SUPPORTED_LOCALES) {
    for (const status of VALID_STATUSES) {
      params.push({ locale, status })
    }
  }
  
  return params
}
