import React from 'react'
import TermsOfService from '@/features/terms/components/terms-of-service'
import { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates, type Locale } from '@/i18n-config'

type TermsParams = {}

/**
 * Terms of Service page component with internationalization support.
 * 
 * @param props - The page properties including params and searchParams as Promises
 * @returns The rendered terms page
 */
export default async function TermsPage(props: LocalePageProps<TermsParams>) {
  // Resolve params
  const params = await props.params;
  
  // Extract and validate locale
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale;

  // React 19 metadata preparation
  const translations = loadTranslations(locale);
  const title = (translations as any).metadata?.terms || 'Terms of Service | Ring App';
  const description = (translations as any).metaDescription?.terms || 'Terms of Service for Ring App - Your business connectivity platform. Read our terms and conditions.';
  const canonicalUrl = `https://ring.ck.ua/${locale}/terms`;
  const alternates = generateHreflangAlternates('/terms');
  
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
      <meta property="og:type" content="article" />
      <meta property="og:locale" content={locale === 'uk' ? 'uk_UA' : 'en_US'} />
      <meta property="og:alternate_locale" content={locale === 'uk' ? 'en_US' : 'uk_UA'} />
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      
      {/* Legal page specific meta tags */}
      <meta name="robots" content="index, follow" />
      <meta name="googlebot" content="index, follow" />
      
      {/* Hreflang alternates */}
      {Object.entries(alternates).map(([lang, url]) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={url as string} />
      ))}

      <TermsOfService />
    </>
  )
}

/* 
 * OBSOLETE FUNCTIONS (removed with React 19 migration):
 * - generateMetadata() function (replaced by React 19 native document metadata)
 * 
 * React 19 Native Features Used:
 * - Document metadata: <title>, <meta>, <link> tags automatically hoisted to <head>
 * - Automatic meta tag deduplication and precedence handling
 * - Native hreflang support for i18n
 * - Legal page SEO optimization (index, follow for compliance content)
 * - OpenGraph article type for legal content
 */