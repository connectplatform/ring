import React from 'react'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n-config'
import StorePageClient from './store-page-client'
import { getSEOMetadata } from '@/lib/seo-metadata'
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates } from '@/i18n-config'
import DesktopSidebar from '@/features/layout/components/desktop-sidebar'
import RightSidebar from '@/features/layout/components/right-sidebar'
import StoreFiltersPanel from '@/components/store/store-filters-panel'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'

export default async function StorePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  
  // Get localized SEO data using the enhanced helper
  const seoData = await getSEOMetadata(validLocale, 'store', {
    count: '20' // Default count for products
  })
  
  const canonicalUrl = `${process.env.NEXT_PUBLIC_API_URL || "https://ring.platform"}${ROUTES.STORE(validLocale)}`
  const alternates = generateHreflangAlternates('/store')
  
  return (
    <>
      {/* React 19 Native Document Metadata with Localized SEO */}
      <title>{seoData?.title || 'Ring Store - Innovative Products & Services'}</title>
      <meta name="description" content={seoData?.description || 'Discover and purchase innovative products and services on Ring platform.'} />
      {seoData?.keywords && (
        <meta name="keywords" content={seoData.keywords.join(', ')} />
      )}
      <link rel="canonical" href={seoData?.canonical || canonicalUrl} />
      
      {/* OpenGraph metadata */}
      <meta property="og:title" content={seoData?.ogTitle || seoData?.title || 'Ring Store'} />
      <meta property="og:description" content={seoData?.ogDescription || seoData?.description || 'Discover innovative products and services'} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content={validLocale === 'uk' ? 'uk_UA' : 'en_US'} />
      <meta property="og:alternate_locale" content={validLocale === 'uk' ? 'en_US' : 'uk_UA'} />
      <meta property="og:site_name" content="Ring Platform" />
      <meta property="og:image" content={seoData?.ogImage || "/images/og-default.jpg"} />
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@RingPlatform" />
      <meta name="twitter:title" content={seoData?.twitterTitle || seoData?.title || 'Ring Store'} />
      <meta name="twitter:description" content={seoData?.twitterDescription || seoData?.description || 'Discover products on Ring Platform'} />
      <meta name="twitter:image" content={seoData?.twitterImage || "/images/og-default.jpg"} />
      
      {/* Additional SEO metadata */}
      <meta name="robots" content="index, follow" />
      <meta name="author" content="Ring Platform" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      
      {/* Hreflang alternates */}
      {Object.entries(alternates).map(([lang, url]) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={url as string} />
      ))}
      
      <div className="min-h-screen bg-background">
        {/* Desktop Layout - Three columns, hidden on iPad and mobile */}
        <div className="hidden lg:grid lg:grid-cols-[280px_1fr_280px] gap-6 min-h-screen">
          {/* Left Sidebar - Navigation */}
          <div>
            <DesktopSidebar />
          </div>

          {/* Main Content - Store Products */}
          <div>
            <StorePageClient key={validLocale} locale={validLocale} />
          </div>

          {/* Right Sidebar - Filters (narrower for more feed space) */}
          <div>
            <RightSidebar title="Filters">
              <StoreFiltersPanel
                resultCount={0}
              />
            </RightSidebar>
          </div>
        </div>

        {/* iPad Layout - Two columns (sidebar + feed), hidden on mobile and desktop */}
        <div className="hidden md:grid md:grid-cols-[280px_1fr] lg:hidden gap-6 min-h-screen">
          {/* Left Sidebar - Navigation */}
          <div>
            <DesktopSidebar />
          </div>

          {/* Main Content - Store Products */}
          <div className="relative">
            <StorePageClient key={validLocale} locale={validLocale} />

            {/* Floating Sidebar Toggle for Filters (iPad only) */}
            <FloatingSidebarToggle>
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Filters</h3>
                <StoreFiltersPanel
                  resultCount={0}
                />
              </div>
            </FloatingSidebarToggle>
          </div>
        </div>

        {/* Mobile Layout - Single column, hidden on iPad and desktop */}
        <div className="md:hidden px-4">
          <StorePageClient key={validLocale} locale={validLocale} />

          {/* Floating Sidebar Toggle for Filters (Mobile only) */}
          <FloatingSidebarToggle>
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Filters</h3>
              <StoreFiltersPanel
                resultCount={0}
              />
            </div>
          </FloatingSidebarToggle>
        </div>
      </div>
    </>
  )
}
