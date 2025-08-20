import React, { use } from 'react'
import type { Locale } from '@/i18n-config'
import CartClient from './cartClient'
import { generatePageMetadata } from '@/utils/seo-metadata'
import { isValidLocale, defaultLocale } from '@/i18n-config'
import type { Metadata } from 'next'

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  return generatePageMetadata(validLocale, 'store.cart')
}

export default function CartPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = use(params)
  return <CartClient key={locale} locale={locale} />
}


