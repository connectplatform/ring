import React from 'react'
import { Suspense } from 'react'
import { cookies, headers } from 'next/headers'
import AboutWrapper from '@/components/wrappers/about-wrapper'
import { auth } from "@/auth"
import { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates, type Locale } from '@/i18n-config'
import { getSEOMetadata } from '@/lib/seo-metadata'

// Allow caching for better performance - about page content doesn't change constantly
export const dynamic = "auto"
export const revalidate = 600 // 10 minutes for static content

type AboutParams = {}

/**
 * AboutPage component for the About Us page of the Ring App.
 * This component handles the rendering of the about page, including SEO elements and the main content wrapper.
 * 
 * @param props - The page properties including params and searchParams as Promises.
 * @returns JSX.Element - The rendered about page.
 */
export default async function AboutPage(props: LocalePageProps<AboutParams>) {
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
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-500 to-green-500 bg-clip-text text-transparent mb-6">
              About Ring Platform
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Ring Platform is building the future of decentralized collaboration, connecting communities worldwide through AI-powered matching and transparent governance.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <div className="bg-card rounded-2xl p-8 shadow-lg border border-border">
              <h3 className="text-2xl font-bold mb-4 text-card-foreground">Our Mission</h3>
              <p className="text-muted-foreground leading-relaxed">
                To democratize access to opportunities and knowledge through decentralized technology, empowering individuals and communities to collaborate, learn, and grow together.
              </p>
            </div>
            <div className="bg-card rounded-2xl p-8 shadow-lg border border-border">
              <h3 className="text-2xl font-bold mb-4 text-card-foreground">Our Vision</h3>
              <p className="text-muted-foreground leading-relaxed">
                A world where geographic and economic barriers no longer limit human potential, where AI serves humanity, and where collective intelligence solves our greatest challenges.
              </p>
            </div>
          </div>

          <div className="bg-card rounded-2xl p-8 shadow-lg mb-16 border border-border">
            <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              What We Build
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🌐</span>
                </div>
                <h3 className="text-xl font-semibold mb-2 text-card-foreground">Open Source Platform</h3>
                <p className="text-muted-foreground">Free, customizable marketplace and community platform for everyone.</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 to-green-500 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🤖</span>
                </div>
                <h3 className="text-xl font-semibold mb-2 text-card-foreground">AI-Powered Matching</h3>
                <p className="text-muted-foreground">Intelligent algorithms connecting people with the right opportunities.</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-green-500 to-blue-500 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">⛓️</span>
                </div>
                <h3 className="text-xl font-semibold mb-2 text-card-foreground">Web3 Integration</h3>
                <p className="text-muted-foreground">Blockchain-based trust, tokens, and transparent governance.</p>
              </div>
            </div>
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