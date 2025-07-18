import React from 'react'
import { Suspense } from 'react'
import { cookies, headers } from 'next/headers'
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates, Locale } from '@/utils/i18n-server'
import { auth } from '@/auth'
import { LocalePageProps } from '@/utils/page-props'
import HomeWrapper from '@/components/home-wrapper'
import { ROUTES } from '@/constants/routes'

// React 19 Resource Preloading APIs
import { preload, preinit } from 'react-dom'

export const dynamic = 'force-dynamic'

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
    preload('/images/hero-banner.webp', { as: 'image' })
    preload('/images/hero-background.jpg', { as: 'image' })
    preload('/images/platform-preview.png', { as: 'image' })
    
    // Preload featured entity and opportunity images
    preload('/images/featured-entities-preview.webp', { as: 'image' })
    preload('/images/featured-opportunities-preview.webp', { as: 'image' })
    
    // Preload home page specific assets
    preload('/images/tech-ecosystem.svg', { as: 'image' })
    preload('/images/collaboration-icon.svg', { as: 'image' })
    preload('/images/innovation-icon.svg', { as: 'image' })
    
    // Preload critical CSS for home page animations
    preload('/styles/home-animations.css', { as: 'style' })
    preload('/styles/hero-section.css', { as: 'style' })
    
    // Preinit home page specific scripts
    preinit('/scripts/home-interactions.js', { as: 'script' })
    preinit('/scripts/hero-animations.js', { as: 'script' })
    
    // Preload API data for home page
    preload('/api/featured-entities', { as: 'fetch' })
    preload('/api/featured-opportunities', { as: 'fetch' })
    preload('/api/platform-stats', { as: 'fetch' })

    // Load translations for React 19 metadata
    const translations = await loadTranslations(locale)
    const title = translations.ringName || 'Ring Platform'
    const description = translations.homeDescription || 'Discover cutting-edge solutions, connect with innovators, and shape the future of technology.'
    const keywords = 'Ring Platform, technology, innovation, opportunities, Cherkasy'
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
        {/* React 19 Native Document Metadata */}
        <title>{`${title} | Ring Platform`}</title>
        <meta name="description" content={description} />
        <meta name="keywords" content={keywords} />
        
        {/* OpenGraph metadata */}
        <meta property="og:title" content={`${title} | Ring Platform`} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://ring.platform${ROUTES.HOME(locale)}`} />
        <meta property="og:image" content="/images/og-home.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:locale" content={locale === 'uk' ? 'uk_UA' : 'en_US'} />
        <meta property="og:alternate_locale" content={locale === 'uk' ? 'en_US' : 'uk_UA'} />
        
        {/* Twitter Card Metadata */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${title} | Ring Platform`} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content="/images/twitter-home.jpg" />
        
        {/* Canonical URL */}
        <link rel="canonical" href={`https://ring.platform${ROUTES.HOME(locale)}`} />
        
        {/* Hreflang alternates */}
        {Object.entries(alternates).map(([hreflang, href]) => (
          <link key={hreflang} rel="alternate" hrefLang={hreflang} href={href} />
        ))}
        
        {/* Structured Data - WebSite Schema */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "Ring Platform",
            "description": description,
            "url": `https://ring.platform${ROUTES.HOME(locale)}`,
            "potentialAction": {
              "@type": "SearchAction",
              "target": {
                "@type": "EntryPoint",
                "urlTemplate": `https://ring.platform${ROUTES.ENTITIES(locale)}?search={search_term_string}`
              },
              "query-input": "required name=search_term_string"
            },
            "publisher": {
              "@type": "Organization",
              "name": "Ring Platform",
              "url": "https://ring.platform",
              "logo": {
                "@type": "ImageObject",
                "url": "https://ring.platform/images/logo.png"
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
    return (
      <>
        <title>Ring Platform | Connect with Tech Opportunities</title>
        <meta name="description" content="Connect with tech opportunities in Cherkasy region" />
        
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold">Welcome to Ring Platform</h1>
              <p className="mt-2 text-gray-600">Connect with tech opportunities in Cherkasy region</p>
            </div>
          </div>
        </div>
      </>
    )
  }
} 