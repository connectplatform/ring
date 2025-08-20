/**
 * Server-side utilities for generating localized SEO metadata
 */

import { loadTranslations } from '@/i18n-config'
import type { Locale } from '@/i18n-config'

interface DynamicValues {
  [key: string]: string | undefined
}

/**
 * Get SEO metadata for a specific page with dynamic value interpolation
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
