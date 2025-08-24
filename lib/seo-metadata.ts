/**
 * React 19 Native SEO Metadata Helper
 * Provides getSEOMetadata function for localized SEO data with interpolation support
 * Works with locales/[locale]/seo.json structure
 */

import { Locale } from '@/i18n-config'

export interface SEOData {
  title?: string
  description?: string
  keywords?: string[]
  canonical?: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  twitterTitle?: string
  twitterDescription?: string
  twitterImage?: string
}

// Cache for loaded SEO translations
const seoCache = new Map<string, Record<string, any>>()

/**
 * Load SEO translations for a given locale
 * @param locale - The locale to load translations for
 * @returns Promise resolving to the SEO translations object
 */
async function loadSEOTranslations(locale: Locale): Promise<Record<string, any>> {
  const cacheKey = `seo-${locale}`
  
  if (seoCache.has(cacheKey)) {
    return seoCache.get(cacheKey)!
  }

  try {
    // Import SEO translations for the locale
    const translations = await import(`@/locales/${locale}/seo.json`)
    const seoData = translations.default || translations
    
    seoCache.set(cacheKey, seoData)
    return seoData
  } catch (error) {
    console.warn(`Failed to load SEO translations for locale ${locale}:`, error)
    
    // Fallback to English if the requested locale fails
    if (locale !== 'en') {
      return loadSEOTranslations('en')
    }
    
    // Return empty object as last resort
    return {}
  }
}

/**
 * Get nested value from object using dot notation
 * @param obj - Object to search in
 * @param path - Dot notation path (e.g., 'entities.status.title')
 * @returns The value at the path or undefined
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

/**
 * Interpolate variables in a string template
 * @param template - String template with {{variable}} placeholders
 * @param variables - Object containing variable values
 * @returns Interpolated string
 */
function interpolateTemplate(template: string, variables: Record<string, any> = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? String(variables[key]) : match
  })
}

/**
 * Get localized SEO metadata for a specific page/section
 * 
 * @param locale - The locale to use for translations
 * @param path - Dot notation path to the SEO data (e.g., 'entities.list', 'store.checkout.status')
 * @param variables - Optional variables for string interpolation
 * @param fallback - Optional fallback SEO data
 * @returns Promise resolving to SEO metadata object
 * 
 * @example
 * ```tsx
 * // Get localized SEO data
 * const seoData = await getSEOMetadata('en', 'entities.list', {
 *   name: entity.name,
 *   count: entities.length.toString()
 * })
 * 
 * return (
 *   <>
 *     <title>{seoData?.title || `${entity.name} - Ring Platform`}</title>
 *     <meta name="description" content={seoData?.description || entity.description} />
 *     <meta property="og:title" content={seoData?.ogTitle || seoData?.title} />
 *     {/* ... other meta tags ... *\/}
 *     <MyComponent />
 *   </>
 * )
 * ```
 */
export async function getSEOMetadata(
  locale: Locale,
  path: string,
  variables: Record<string, any> = {},
  fallback?: Partial<SEOData>
): Promise<SEOData | null> {
  try {
    const translations = await loadSEOTranslations(locale)
    const seoTemplate = getNestedValue(translations, path)
    
    if (!seoTemplate) {
      console.warn(`SEO template not found for path: ${path} in locale: ${locale}`)
      return fallback ? { ...fallback } : null
    }
    
    // If seoTemplate is a string, treat it as title
    if (typeof seoTemplate === 'string') {
      const title = interpolateTemplate(seoTemplate, variables)
      return {
        title,
        description: fallback?.description,
        ...fallback
      }
    }
    
    // Process object template with interpolation
    const result: SEOData = {}
    
    if (seoTemplate.title) {
      result.title = interpolateTemplate(seoTemplate.title, variables)
    }
    
    if (seoTemplate.description) {
      result.description = interpolateTemplate(seoTemplate.description, variables)
    }
    
    if (seoTemplate.keywords && Array.isArray(seoTemplate.keywords)) {
      result.keywords = seoTemplate.keywords.map((keyword: string) => 
        interpolateTemplate(keyword, variables)
      )
    }
    
    // Handle OpenGraph metadata
    if (seoTemplate.ogTitle) {
      result.ogTitle = interpolateTemplate(seoTemplate.ogTitle, variables)
    }
    
    if (seoTemplate.ogDescription) {
      result.ogDescription = interpolateTemplate(seoTemplate.ogDescription, variables)
    }
    
    if (seoTemplate.ogImage) {
      result.ogImage = interpolateTemplate(seoTemplate.ogImage, variables)
    }
    
    // Handle Twitter metadata
    if (seoTemplate.twitterTitle) {
      result.twitterTitle = interpolateTemplate(seoTemplate.twitterTitle, variables)
    }
    
    if (seoTemplate.twitterDescription) {
      result.twitterDescription = interpolateTemplate(seoTemplate.twitterDescription, variables)
    }
    
    if (seoTemplate.twitterImage) {
      result.twitterImage = interpolateTemplate(seoTemplate.twitterImage, variables)
    }
    
    // Handle canonical URL
    if (seoTemplate.canonical) {
      result.canonical = interpolateTemplate(seoTemplate.canonical, variables)
    }
    
    // Merge with fallback data
    return {
      ...fallback,
      ...result
    }
    
  } catch (error) {
    console.error(`Error loading SEO metadata for ${path} in ${locale}:`, error)
    return fallback ? { ...fallback } : null
  }
}

/**
 * Generate hreflang alternates for the current page
 * @param pathname - The current page path
 * @param locales - Array of supported locales
 * @returns Record of locale -> URL mappings
 */
export function generateHreflangAlternates(
  pathname: string, 
  locales: readonly Locale[] = ['en', 'uk']
): Record<string, string> {
  const alternates: Record<string, string> = {}
  
  for (const locale of locales) {
    alternates[locale] = `/${locale}${pathname}`
  }
  
  return alternates
}

/**
 * Get default SEO fallback data
 * @param locale - The locale for fallback data
 * @returns Default SEO data object
 */
export function getDefaultSEOData(locale: Locale): SEOData {
  return {
    title: 'Ring Platform - Decentralized Opportunities',
    description: 'Connect, collaborate, and create value in the decentralized economy',
    keywords: ['decentralized', 'opportunities', 'blockchain', 'collaboration', 'web3'],
    canonical: `/${locale}`,
    ogTitle: 'Ring Platform - Decentralized Opportunities',
    ogDescription: 'Discover and create opportunities in the decentralized economy',
    ogImage: '/images/og-default.jpg',
    twitterTitle: 'Ring Platform',
    twitterDescription: 'Decentralized opportunities and collaboration platform',
    twitterImage: '/images/og-default.jpg'
  }
}

/**
 * React 19 Native Metadata Helper (removed renderMetaTags - use inline metadata instead)
 * The renderMetaTags function has been removed as all pages now use inline React 19 native metadata.
 * Use getSEOMetadata() with inline <title>, <meta>, and <link> tags in your components.
 */
