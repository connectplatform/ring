import React from 'react'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n-config'
import StorePageClient from './store-page-client'
import { getSEOMetadata } from '@/utils/seo-metadata'
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates } from '@/i18n-config'

export default async function StorePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  
  // Get SEO metadata
  const metadata = getSEOMetadata(validLocale, 'store.list')
  const translations = loadTranslations(validLocale)
  const title = metadata?.title || (translations as any).store?.title || 'Store | Ring Platform'
  const description = metadata?.description || (translations as any).store?.description || 'Browse our products and services'
  const canonicalUrl = `https://ring.platform${ROUTES.STORE(validLocale)}`
  const alternates = generateHreflangAlternates('/store')
  
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
      <meta property="og:locale" content={validLocale === 'uk' ? 'uk_UA' : 'en_US'} />
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      
      {/* Hreflang alternates */}
      {Object.entries(alternates).map(([lang, url]) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={url as string} />
      ))}
      
      <StorePageClient key={validLocale} locale={validLocale} />
    </>
  )
}
