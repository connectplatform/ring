import React, { use } from 'react'
import type { Locale } from '@/i18n-config'
import ProductDetailsClient from './productDetailsClient'
import { getSEOMetadata } from '@/lib/seo-metadata'
import { isValidLocale, defaultLocale } from '@/i18n-config'

// Metadata will be handled inline using React 19 native approach

export default async function ProductDetailsPage({ params }: { params: Promise<{ locale: Locale, id: string }> }) {
  const { locale, id } = await params
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  
  // Get SEO metadata for the product detail page
  // TODO: Fetch actual product data for dynamic metadata
  const seoData = await getSEOMetadata(
    validLocale, 
    'store.product', 
    { 
      name: 'Product', // TODO: Replace with actual product name
      description: 'Product details' // TODO: Replace with actual product description
    }
  )
  
  return (
    <>
      {/* React 19 Native Metadata */}
      <title>{seoData?.title || `Product - Ring Store`}</title>
      <meta name="description" content={seoData?.description || 'View product details and purchase on Ring Store'} />
      {seoData?.keywords && (
        <meta name="keywords" content={seoData.keywords.join(', ')} />
      )}
      {seoData?.canonical && (
        <link rel="canonical" href={seoData.canonical} />
      )}
      
      {/* OpenGraph metadata */}
      <meta property="og:title" content={seoData?.ogTitle || seoData?.title || `Product - Ring Store`} />
      <meta property="og:description" content={seoData?.ogDescription || seoData?.description || 'View product details and purchase on Ring Store'} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content={validLocale === 'uk' ? 'uk_UA' : 'en_US'} />
      <meta property="og:site_name" content="Ring Platform" />
      {seoData?.ogImage && (
        <meta property="og:image" content={seoData.ogImage} />
      )}
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@RingPlatform" />
      <meta name="twitter:title" content={seoData?.twitterTitle || seoData?.title || `Product - Ring Store`} />
      <meta name="twitter:description" content={seoData?.twitterDescription || seoData?.description || 'View product details and purchase on Ring Store'} />
      {seoData?.twitterImage && (
        <meta name="twitter:image" content={seoData.twitterImage} />
      )}
      
      {/* Hreflang alternates */}
      <link rel="alternate" hrefLang="en" href={`/en/store/${id}`} />
      <link rel="alternate" hrefLang="uk" href={`/uk/store/${id}`} />
      
      {/* Standard SEO metadata */}
      <meta name="robots" content="index, follow" />
      <meta name="author" content="Ring Platform" />
      
      <ProductDetailsClient key={`${locale}-${id}`} locale={locale} id={id} />
    </>
  )
}


