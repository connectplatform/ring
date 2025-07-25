import React from 'react'
import { Suspense } from 'react'
import { cookies, headers } from 'next/headers'
import AboutWrapper from '@/components/about-wrapper'
import { getServerAuthSession } from "@/auth"
import { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates, Locale } from '@/utils/i18n-server'

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic'

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

  // Load translations for the current locale
  const translations = loadTranslations(locale);

  // React 19 metadata preparation (replacing MetaTags component)
  const title = (translations as any).metadata?.about || 'About Us - Ring App Tech Ecosystem';
  const description = (translations as any).metaDescription?.about || 'Learn about the Ring App and the tech ecosystem in Cherkasy region';
  const canonicalUrl = `https://ring.ck.ua/${locale}/about`;
  const ogImage = "https://ring.ck.ua/about-og-image.jpg";
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
  const session = await getServerAuthSession();
  console.log('AboutPage: Session authenticated', { 
    sessionExists: !!session, 
    userId: session?.user?.id, 
    role: session?.user?.role 
  });

  // Step 5: Prepare JsonLd data for SEO (now using React 19 native script tag)
  const aboutTitle = (translations as any).metadata?.about || 'About Ring App';
  const aboutDescription = (translations as any).metaDescription?.about || 'Learn about the Ring App and the tech ecosystem in Cherkasy region';
  
  const jsonLdData = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "url": `https://ring.ck.ua/${locale}/about`,
    "name": aboutTitle,
    "description": aboutDescription,
    "inLanguage": locale
  }

  // Step 6: Render the about page
  return (
    <>
      {/* React 19 Native Document Metadata (replaces MetaTags component) */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      
      {/* OpenGraph metadata */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:locale" content={locale === 'uk' ? 'uk_UA' : 'en_US'} />
      <meta property="og:alternate_locale" content={locale === 'uk' ? 'en_US' : 'uk_UA'} />
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      
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
        <AboutWrapper 
          userAgent={userAgent}
          token={token}
          params={{
            slug: 'about' // Use 'about' as the slug for the about page
          }}
          searchParams={searchParams}
        />
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