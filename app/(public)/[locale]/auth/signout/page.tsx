import React from 'react'
import type { Locale } from '@/i18n-config'
import AuthStatusPage from '@/components/auth/auth-status-page'
import { getSEOMetadata } from '@/lib/seo-metadata'
import { isValidLocale, defaultLocale } from '@/i18n-config'



export default async function SignOutStatusPage({ 
  params 
}: { 
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  
  // Get SEO metadata for the signout status
  const seoData = await getSEOMetadata(
    validLocale, 
    'auth.status', 
    { 
      action: 'Sign Out',
      status: 'Success'
    }
  )
  
  return (
    <>
      {/* React 19 Native Metadata */}
      <title>{seoData?.title || 'Successfully Signed Out - Ring Platform'}</title>
      <meta name="description" content={seoData?.description || 'You have successfully signed out of Ring Platform. Redirecting to login page.'} />
      {seoData?.keywords && (
        <meta name="keywords" content={seoData.keywords.join(', ')} />
      )}
      {seoData?.canonical && (
        <link rel="canonical" href={seoData.canonical} />
      )}
      
      {/* OpenGraph metadata */}
      <meta property="og:title" content={seoData?.ogTitle || seoData?.title || 'Successfully Signed Out - Ring Platform'} />
      <meta property="og:description" content={seoData?.ogDescription || seoData?.description || 'You have successfully signed out of Ring Platform.'} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content={validLocale === 'uk' ? 'uk_UA' : 'en_US'} />
      <meta property="og:site_name" content="Ring Platform" />
      {seoData?.ogImage && (
        <meta property="og:image" content={seoData.ogImage} />
      )}
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:site" content="@RingPlatform" />
      <meta name="twitter:title" content={seoData?.twitterTitle || seoData?.title || 'Successfully Signed Out'} />
      <meta name="twitter:description" content={seoData?.twitterDescription || seoData?.description || 'You have successfully signed out of Ring Platform.'} />
      {seoData?.twitterImage && (
        <meta name="twitter:image" content={seoData.twitterImage} />
      )}
      
      {/* Hreflang alternates */}
      <link rel="alternate" hrefLang="en" href="/en/auth/signout" />
      <link rel="alternate" hrefLang="uk" href="/uk/auth/signout" />
      
      {/* Standard SEO metadata */}
      <meta name="robots" content="noindex, nofollow" />
      <meta name="author" content="Ring Platform" />

      <AuthStatusPage 
        action="signout"
        status="success"
        locale={validLocale}
      />
    </>
  )
}
