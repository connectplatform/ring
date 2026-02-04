import React from 'react'
import { Suspense } from 'react'
import { cookies, headers } from 'next/headers'
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates, type Locale } from '@/i18n-config'
import { auth } from '@/auth'
import { LocalePageProps } from '@/utils/page-props'
import HomeWrapper from '@/components/wrappers/home-wrapper'
import { ROUTES } from '@/constants/routes'
import { getSEOMetadata } from '@/lib/seo-metadata'

// React 19 Resource Preloading APIs
import { preload, preinit } from 'react-dom'

// Allow caching for better performance - homepage content doesn't change constantly
export const dynamic = "auto"
export const revalidate = 300 // 5 minutes for public content

type HomePageParams = {}

export default async function HomePage({ params, searchParams }: LocalePageProps<HomePageParams>) {
  try {
    const resolvedParams = await params
    const resolvedSearchParams = await searchParams
    const locale = isValidLocale(resolvedParams.locale) ? resolvedParams.locale : defaultLocale
    
    // Validate locale
    if (!isValidLocale(locale)) {
      throw new Error(`Invalid locale: ${locale}`)
    }

    // React 19 Resource Preloading - Home Page Performance Optimization
    
      // Preload hero section critical images
      // preload('/images/hero-banner.webp', { as: 'image' })
      // preload('/images/hero-background.jpg', { as: 'image' })
      // preload('/images/platform-preview.png', { as: 'image' })
    // Trimmed preloads: only logo and font which are always used above the fold
    
    // Scripts are loaded where needed; avoid preinit in dev to reduce noise
    
    // Avoid preloading API calls; fetch on demand in components

    // Get localized SEO data using the enhanced helper
    const seoData = await getSEOMetadata(locale, 'home', {
      platform: 'Ring Platform'
    })
    
    const alternates = generateHreflangAlternates('/')
    
    // Get server-side data
    const headersList = await headers()
    const userAgent = headersList.get('user-agent')
    const cookieStore = await cookies()
    const token = cookieStore.get('next-auth.session-token')?.value
    
    // Get session using Auth.js v5 universal auth() method
    const session = await auth().catch(() => null)
    
    // Transform params to match HomeWrapper expectations
    const homeWrapperParams = { slug: undefined }
    
    return (
      <>
        {/* React 19 Native Document Metadata with Localized SEO */}
        <title>{seoData?.title || 'Ring Platform - Decentralized Opportunities'}</title>
        <meta name="description" content={seoData?.description || 'Connect, collaborate, and create value in the decentralized economy'} />
        {seoData?.keywords && (
          <meta name="keywords" content={seoData.keywords.join(', ')} />
        )}
        
        {/* OpenGraph metadata */}
        <meta property="og:title" content={seoData?.ogTitle || seoData?.title || 'Ring Platform'} />
        <meta property="og:description" content={seoData?.ogDescription || seoData?.description || 'Discover and create opportunities in the decentralized economy'} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${process.env.NEXT_PUBLIC_API_URL}${ROUTES.HOME(locale)}`} />
        <meta property="og:image" content={seoData?.ogImage || "/images/og-default.jpg"} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:locale" content={locale === 'uk' ? 'uk_UA' : 'en_US'} />
        <meta property="og:alternate_locale" content={locale === 'uk' ? 'en_US' : 'uk_UA'} />
        <meta property="og:site_name" content="Ring Platform" />
        
        {/* Twitter Card Metadata */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@RingPlatform" />
        <meta name="twitter:title" content={seoData?.twitterTitle || seoData?.title || 'Ring Platform'} />
        <meta name="twitter:description" content={seoData?.twitterDescription || seoData?.description || 'Decentralized opportunities and collaboration platform'} />
        <meta name="twitter:image" content={seoData?.twitterImage || "/images/og-default.jpg"} />
        
        {/* Canonical URL */}
        <link rel="canonical" href={seoData?.canonical || `${process.env.NEXT_PUBLIC_API_URL}${ROUTES.HOME(locale)}`} />
        
        {/* Hreflang alternates */}
        {Object.entries(alternates).map(([hreflang, href]) => (
          <link key={hreflang} rel="alternate" hrefLang={hreflang} href={href as string} />
        ))}
        
        {/* Additional SEO metadata */}
        <meta name="robots" content="index, follow" />
        <meta name="author" content="Ring Platform" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        
        {/* Structured Data - WebSite Schema */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "Ring Platform",
            "description": seoData?.description || 'Connect, collaborate, and create value in the decentralized economy',
            "url": `${process.env.NEXT_PUBLIC_API_URL}${ROUTES.HOME(locale)}`,
            "potentialAction": {
              "@type": "SearchAction",
              "target": {
                "@type": "EntryPoint",
                "urlTemplate": `${process.env.NEXT_PUBLIC_API_URL}${ROUTES.ENTITIES(locale)}?search={search_term_string}`
              },
              "query-input": "required name=search_term_string"
            },
            "publisher": {
              "@type": "Organization",
              "name": "Ring Platform",
              "url": process.env.NEXT_PUBLIC_API_URL,
              "logo": {
                "@type": "ImageObject",
                "url": `${process.env.NEXT_PUBLIC_API_URL}/logo.svg`
              }
            },
            "inLanguage": locale
          })
        }} />

        <Suspense fallback={<div>Loading...</div>}>
          <HomeWrapper 
            userAgent={userAgent}
            token={token}
            params={homeWrapperParams}
            searchParams={resolvedSearchParams}
            user={session?.user}
          />
        </Suspense>
      </>
    )
  } catch (e) {
    console.error("HomePage: Error loading page data:", e)
    
    // Fallback return with minimal metadata
    const fallbackSEO = await getSEOMetadata(defaultLocale, 'home').catch(() => null)
    
    return (
      <>
        <title>{fallbackSEO?.title || 'Ring Platform - Connect with Tech Opportunities'}</title>
        <meta name="description" content={fallbackSEO?.description || 'Connect with tech opportunities in Cherkasy region'} />
        
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold">Welcome to Ring</h1>
              <p className="mt-2 text-gray-600">Your portal to the quantum world</p>
            </div>
          </div>
        </div>
      </>
    )
  }
} 