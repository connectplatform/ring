/**
 * Server-side utilities for generating localized SEO metadata
 * 
 * Provides functions to generate dynamic SEO metadata for pages
 * with support for internationalization and dynamic value interpolation
 */

import { loadTranslations } from '@/i18n-config'
import type { Locale } from '@/i18n-config'

/**
 * Interface for dynamic values that can be interpolated into SEO metadata
 * Keys correspond to placeholders in translation strings (e.g., {{name}})
 */
interface DynamicValues {
  [key: string]: string | undefined
}

/**
 * Get SEO metadata for a specific page with dynamic value interpolation
 * 
 * Loads translations for the specified locale and extracts SEO metadata
 * from the nested path structure. Supports dynamic value interpolation
 * using {{placeholder}} syntax in translation strings.
 * 
 * @param locale - The locale to load translations for
 * @param path - Dot-separated path to the SEO metadata (e.g., "entities.list")
 * @param dynamicValues - Optional object with values to interpolate into metadata
 * @returns SEO metadata object with title, description, and social media tags
 * 
 * @example
 * ```typescript
 * const metadata = getSEOMetadata('en', 'entities.list', {
 *   name: 'Tech Companies',
 *   count: '150'
 * });
 * // Returns metadata with {{name}} and {{count}} replaced
 * ```
 */
export function getSEOMetadata(
  locale: Locale,
  path: string,
  dynamicValues?: DynamicValues
) {
  const translations = loadTranslations(locale) as any
  const seo = translations?.seo || {}
  
  // Navigate to the nested path (e.g., "entities.list" -> seo.entities.list)
  const keys = path.split('.')
  let metadata: any = seo
  
  for (const key of keys) {
    metadata = metadata?.[key]
    if (!metadata) break
  }
  
  if (!metadata || typeof metadata !== 'object') {
    return null
  }
  
  // Interpolate dynamic values (e.g., {{name}} -> actual name)
  let title = metadata.title || ''
  let description = metadata.description || ''
  
  if (dynamicValues) {
    Object.entries(dynamicValues).forEach(([key, value]) => {
      if (value) {
        const pattern = new RegExp(`{{${key}}}`, 'g')
        title = title.replace(pattern, value)
        description = description.replace(pattern, value)
      }
    })
  }
  
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      locale: locale === 'uk' ? 'uk_UA' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    }
  }
}

/**
 * Generate Next.js metadata object for a page
 * 
 * Creates a complete metadata object suitable for use in Next.js
 * generateMetadata function. Includes fallback metadata if the
 * requested SEO data is not found.
 * 
 * @param locale - The locale to load translations for
 * @param seoKey - Dot-separated path to the SEO metadata
 * @param dynamicValues - Optional object with values to interpolate
 * @returns Next.js metadata object with title, description, and social tags
 * 
 * @example
 * ```typescript
 * // In generateMetadata function
 * export async function generateMetadata({ params }: LocaleMetadataProps) {
 *   return generatePageMetadata(
 *     params.locale,
 *     'entities.list',
 *     { name: 'Featured Companies' }
 *   );
 * }
 * ```
 */
export async function generatePageMetadata(
  locale: Locale,
  seoKey: string,
  dynamicValues?: DynamicValues
) {
  const metadata = getSEOMetadata(locale, seoKey, dynamicValues)
  
  if (!metadata) {
    // Fallback metadata
    return {
      title: 'Ring Platform',
      description: 'Tech Innovation Hub'
    }
  }
  
  return {
    title: metadata.title,
    description: metadata.description,
    openGraph: metadata.openGraph,
    twitter: metadata.twitter,
  }
}
