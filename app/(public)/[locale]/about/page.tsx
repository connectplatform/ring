import React from 'react'
import { Suspense } from 'react'
import { cookies, headers } from 'next/headers'
import AboutWrapper from '@/components/wrappers/about-wrapper'
import { auth } from "@/auth"
import { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates, type Locale } from '@/i18n-config'
import { getSEOMetadata } from '@/lib/seo-metadata'
import { connection } from 'next/server'

// Force dynamic rendering for this page

type AboutParams = {}

/**
 * AboutPage component for the About Us page of the Ring App.
 * This component handles the rendering of the about page, including SEO elements and the main content wrapper.
 * 
 * @param props - The page properties including params and searchParams as Promises.
 * @returns JSX.Element - The rendered about page.
 */
export default async function AboutPage(props: LocalePageProps<AboutParams>) {
  await connection() // Next.js 16: opt out of prerendering

  // Resolve params and searchParams
  const params = await props.params;
  const searchParams = await props.searchParams;

  // Extract and validate locale
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale;
  console.log('AboutPage: Using locale', locale);

  // Get localized SEO data using the enhanced helper
  const seoData = await getSEOMetadata(locale, 'about')
  
  const canonicalUrl = `${process.env.NEXT_PUBLIC_API_URL || "https://ring.platform"}/${locale}/about`;
  const alternates = generateHreflangAlternates('/about');

  // Step 2: Retrieve cookies and headers
  // Use await with cookies() and headers() as they are now async in Next.js 15
  const cookieStore = await cookies()
  const headersList = await headers()
  const token = cookieStore.get("token")?.value
  const userAgent = headersList.get('user-agent')
  
  // Step 3: Log request details
  console.log('AboutPage: Starting');
  console.log('AboutPage: Request details', {
    params,
    searchParams,
    locale,
    userAgent,
    hasToken: !!token
  });

  // Step 4: Authenticate user session
  console.log('AboutPage: Authenticating session');
  const session = await auth();
  console.log('AboutPage: Session authenticated', { 
    sessionExists: !!session, 
    userId: session?.user?.id, 
    role: session?.user?.role 
  });

  // Step 5: Prepare JsonLd data for SEO (now using React 19 native script tag)
  const jsonLdData = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "url": canonicalUrl,
    "name": seoData?.title || 'About Ring Platform',
    "description": seoData?.description || 'Learn about Ring Platform and the decentralized professional network',
    "inLanguage": locale
  }

  // Step 6: Render the about page
  return (
    <>
      {/* React 19 Native Document Metadata with Localized SEO */}
      <title>{seoData?.title || 'About Ring Platform - Decentralized Professional Network'}</title>
      <meta name="description" content={seoData?.description || 'Learn about Ring Platform\'s mission to create a decentralized professional networking ecosystem'} />
      {seoData?.keywords && (
        <meta name="keywords" content={seoData.keywords.join(', ')} />
      )}
      <link rel="canonical" href={seoData?.canonical || canonicalUrl} />
      
      {/* OpenGraph metadata */}
      <meta property="og:title" content={seoData?.ogTitle || seoData?.title || 'About Ring Platform'} />
      <meta property="og:description" content={seoData?.ogDescription || seoData?.description || 'Discover Ring Platform\'s vision for decentralized professional networking'} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={seoData?.ogImage || "/images/og-default.jpg"} />
      <meta property="og:locale" content={locale === 'uk' ? 'uk_UA' : 'en_US'} />
      <meta property="og:alternate_locale" content={locale === 'uk' ? 'en_US' : 'uk_UA'} />
      <meta property="og:site_name" content="Ring Platform" />
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@RingPlatform" />
      <meta name="twitter:title" content={seoData?.twitterTitle || seoData?.title || 'About Ring Platform'} />
      <meta name="twitter:description" content={seoData?.twitterDescription || seoData?.description || 'Learn about our decentralized platform'} />
      <meta name="twitter:image" content={seoData?.twitterImage || "/images/og-default.jpg"} />
      
      {/* Additional SEO metadata */}
      <meta name="robots" content="index, follow" />
      <meta name="author" content="Ring Platform" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      
      {/* Hreflang alternates */}
      {Object.entries(alternates).map(([lang, url]) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={url} />
      ))}
      
      {/* React 19 Native JsonLd (replaces JsonLd component) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdData) }}
      />

      <Suspense fallback={
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
        </div>
      }>
        {/* Step 6c: Render the main content wrapper */}
        <AboutWrapper locale={locale}>
          {/* About page content rendered within the wrapper */}
          <div className="p-6">
            <h1 className="text-3xl font-bold mb-4">About GreenFood.live</h1>
            <p className="text-muted-foreground">
              Welcome to GreenFood.live - your trusted source for sustainable, organic produce.
            </p>
          </div>
        </AboutWrapper>
      </Suspense>
    </>
  )
}

/* 
 * OBSOLETE COMPONENTS (can be removed after React 19 migration):
 * - components/seo/meta-tags.tsx (replaced by React 19 native <meta> tags)
 * - components/seo/json-ld.tsx (replaced by React 19 native <script> tag)
 * 
 * React 19 Native Features Used:
 * - Document metadata: <title>, <meta>, <link> tags automatically hoisted to <head>
 * - Native script management: <script> tags with JSON-LD structured data
 * - Automatic meta tag deduplication and precedence handling
 */