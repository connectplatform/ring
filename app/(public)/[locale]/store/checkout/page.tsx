import React, { use } from 'react'
import type { Locale } from '@/i18n-config'
import CheckoutClient from './checkoutClient'
import { generatePageMetadata } from '@/utils/seo-metadata'
import { isValidLocale, defaultLocale } from '@/i18n-config'
import type { Metadata } from 'next'

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  return generatePageMetadata(validLocale, 'store.checkout')
}

export default function CheckoutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = use(params)
  return <CheckoutClient key={locale} locale={locale} />
}


