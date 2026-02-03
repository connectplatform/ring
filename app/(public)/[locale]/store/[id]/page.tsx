import React from 'react'
import type { Locale } from '@/i18n-config'
import ProductDetailsWrapper from '@/components/wrappers/product-details-wrapper'
import ProductDetailsClient from './productDetailsClient'
import { getSEOMetadata } from '@/lib/seo-metadata'
import { isValidLocale, defaultLocale } from '@/i18n-config'
import { RingStoreService } from '@/features/store/service'
import { PostgreSQLStoreAdapter } from '@/features/store/postgresql-adapter'
import { generateProductEmbedding } from '@/lib/vector-search'
import { notFound } from 'next/navigation'

// Metadata will be handled inline using React 19 native approach

export default async function ProductDetailsPage({ params }: { params: Promise<{ locale: Locale, id: string }> }) {
  const { locale, id } = await params
  const validLocale = isValidLocale(locale) ? locale : defaultLocale

  // Fetch product data for metadata and similar products
  // Use PostgreSQL adapter directly for SSR compatibility
  // OPTIMIZED: Direct O(1) lookup by ID instead of fetching all products
  let currentProduct = null
  try {
    const pgAdapter = new PostgreSQLStoreAdapter()
    // Direct database lookup - O(1) instead of O(n)
    currentProduct = await pgAdapter.getProductById(id)
  } catch (error) {
    console.error('PostgreSQL fetch failed:', error)
  }

  // If not found in database, try mock data
  if (!currentProduct) {
    try {
      const { MockStoreAdapter } = await import('@/features/store/mock-adapter')
      const mockAdapter = new MockStoreAdapter()
      const mockProducts = await mockAdapter.listProducts()
      currentProduct = mockProducts.find(p => p.id === id)
    } catch (mockError) {
      console.error('Mock data fallback also failed:', mockError)
    }
  }

  // If still not found, return 404
  if (!currentProduct) {
    notFound()
  }

  // Add embedding if not present
  if (!currentProduct.embedding) {
    currentProduct.embedding = generateProductEmbedding({
      name: currentProduct.name,
      description: currentProduct.description,
      category: currentProduct.category,
      tags: currentProduct.tags
    })
  }
  
  // Get SEO metadata for the product detail page
  const seoData = await getSEOMetadata(
    validLocale, 
    'store.product', 
    { 
      name: currentProduct?.name || 'Product',
      description: currentProduct?.description || 'Product details'
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

      <ProductDetailsWrapper locale={validLocale} productId={id} currentProduct={currentProduct}>
        <ProductDetailsClient key={`${locale}-${id}`} locale={locale} id={id} />
      </ProductDetailsWrapper>
    </>
  )
}


