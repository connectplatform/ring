import React, { use } from 'react'
import type { Locale } from '@/i18n-config'
import ProductDetailsClient from './productDetailsClient'
import { generatePageMetadata } from '@/utils/seo-metadata'
import { isValidLocale, defaultLocale } from '@/i18n-config'
import type { Metadata } from 'next'

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale, id: string }> }): Promise<Metadata> {
  const { locale } = await params
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  // TODO: Fetch actual product name and description for dynamic metadata
  return generatePageMetadata(validLocale, 'store.product', { name: 'Product', description: 'Product details' })
}

export default function ProductDetailsPage({ params }: { params: Promise<{ locale: Locale, id: string }> }) {
  const { locale, id } = use(params)
  return <ProductDetailsClient key={`${locale}-${id}`} locale={locale} id={id} />
}


