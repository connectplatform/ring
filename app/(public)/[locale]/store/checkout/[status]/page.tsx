import React, { use } from 'react'
import type { Locale } from '@/i18n-config'
import CheckoutStatusPage from '@/components/store/checkout-status-page'
import { getSEOMetadata } from '@/lib/seo-metadata'
import { isValidLocale, defaultLocale } from '@/i18n-config'
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

// Metadata will be handled inline using React 19 native approach

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
  
  // Get SEO metadata for the checkout status
  const seoData = await getSEOMetadata(
    validLocale, 
    'store.checkout.status', 
    { 
      status: status.charAt(0).toUpperCase() + status.slice(1) 
    }
  )
  
  return (
    <>
      {/* React 19 Native Metadata */}
      <title>{seoData?.title || `Checkout ${status.charAt(0).toUpperCase() + status.slice(1)} - Ring Store`}</title>
      <meta name="description" content={seoData?.description || `Your checkout is ${status}. View your order status and next steps.`} />
      {seoData?.keywords && (
        <meta name="keywords" content={seoData.keywords.join(', ')} />
      )}
      {seoData?.canonical && (
        <link rel="canonical" href={seoData.canonical} />
      )}
      
      {/* OpenGraph metadata */}
      <meta property="og:title" content={seoData?.ogTitle || seoData?.title || `Checkout ${status.charAt(0).toUpperCase() + status.slice(1)} - Ring Store`} />
      <meta property="og:description" content={seoData?.ogDescription || seoData?.description || `Your checkout is ${status}. View your order status and next steps.`} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content={validLocale === 'uk' ? 'uk_UA' : 'en_US'} />
      <meta property="og:site_name" content="Ring Platform" />
      {seoData?.ogImage && (
        <meta property="og:image" content={seoData.ogImage} />
      )}
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@RingPlatform" />
      <meta name="twitter:title" content={seoData?.twitterTitle || seoData?.title || `Checkout ${status.charAt(0).toUpperCase() + status.slice(1)} - Ring Store`} />
      <meta name="twitter:description" content={seoData?.twitterDescription || seoData?.description || `Your checkout is ${status}. View your order status and next steps.`} />
      {seoData?.twitterImage && (
        <meta name="twitter:image" content={seoData.twitterImage} />
      )}
      
      {/* Hreflang alternates */}
      <link rel="alternate" hrefLang="en" href={`/en/store/checkout/${status}`} />
      <link rel="alternate" hrefLang="uk" href={`/uk/store/checkout/${status}`} />
      
      {/* Standard SEO metadata */}
      <meta name="robots" content="index, follow" />
      <meta name="author" content="Ring Platform" />

      <CheckoutStatusPage 
        status={status as CheckoutStatus}
        locale={validLocale}
      />
    </>
  )
}

// Generate static params for all valid checkout statuses
export async function generateStaticParams() {
  const params = []
  
  for (const locale of ['en', 'uk'] as const) {
    for (const status of VALID_STATUSES) {
      params.push({ locale, status })
    }
  }
  
  return params
}
