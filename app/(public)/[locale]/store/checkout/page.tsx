import React from 'react'
import type { Locale } from '@/i18n-config'
import CheckoutClient from './checkoutClient'
import { getSEOMetadata } from '@/lib/seo-metadata'
import { isValidLocale, defaultLocale } from '@/i18n-config'

// Metadata will be handled inline using React 19 native approach

export default async function CheckoutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  
  // Get SEO metadata for the checkout page
  const seoData = await getSEOMetadata(validLocale, 'store.checkout')
  
  return (
    <>
      {/* React 19 Native Metadata */}
      <title>{seoData?.title || 'Secure Checkout - Ring Store'}</title>
      <meta name="description" content={seoData?.description || 'Complete your purchase securely on Ring platform. Multiple payment options available including RING tokens and traditional methods.'} />
      {seoData?.keywords && (
        <meta name="keywords" content={seoData.keywords.join(', ')} />
      )}
      {seoData?.canonical && (
        <link rel="canonical" href={seoData.canonical} />
      )}
      
      {/* OpenGraph metadata */}
      <meta property="og:title" content={seoData?.ogTitle || seoData?.title || 'Secure Checkout - Ring Store'} />
      <meta property="og:description" content={seoData?.ogDescription || seoData?.description || 'Complete your purchase securely on Ring platform. Multiple payment options available including RING tokens and traditional methods.'} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content={validLocale === 'uk' ? 'uk_UA' : 'en_US'} />
      <meta property="og:site_name" content="Ring Platform" />
      {seoData?.ogImage && (
        <meta property="og:image" content={seoData.ogImage} />
      )}
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@RingPlatform" />
      <meta name="twitter:title" content={seoData?.twitterTitle || seoData?.title || 'Secure Checkout - Ring Store'} />
      <meta name="twitter:description" content={seoData?.twitterDescription || seoData?.description || 'Complete your purchase securely on Ring platform. Multiple payment options available including RING tokens and traditional methods.'} />
      {seoData?.twitterImage && (
        <meta name="twitter:image" content={seoData.twitterImage} />
      )}
      
      {/* Hreflang alternates */}
      <link rel="alternate" hrefLang="en" href="/en/store/checkout" />
      <link rel="alternate" hrefLang="uk" href="/uk/store/checkout" />
      
      {/* Standard SEO metadata */}
      <meta name="robots" content="index, follow" />
      <meta name="author" content="Ring Platform" />
      
      <CheckoutClient key={locale} locale={locale} />
    </>
  )
}


