import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import React from 'react'
import type { Locale } from '@/i18n/shared'
import CheckoutWrapper from '@/components/wrappers/checkout-wrapper'
import CheckoutClient from './checkout-client'
import { isValidLocale, defaultLocale } from '@/i18n/shared'


export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'store.checkout',
    variables: {},
    pathname: '/store/checkout',
    siteName: 'Ring Platform',
    twitterSite: '@RingPlatform',
  })
}

export default async function CheckoutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  
  return (
      <CheckoutWrapper locale={validLocale}>
        <CheckoutClient key={locale} locale={locale} />
      </CheckoutWrapper>
  )
}


