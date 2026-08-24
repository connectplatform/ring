import 'server-only'

import type { Metadata } from 'next'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { type Locale } from '@/i18n/shared'
import { withLocalePath } from '@/lib/hreflang'
import { openGraphAlternateLocaleTags, openGraphLocaleTag } from '@/lib/locale-config'
import { getRingSeoBranding, getSiteBaseUrl } from '@/lib/ring-config-core'

export { generateHreflangAlternates, withLocalePath } from '@/lib/hreflang'
export { stripLocalePrefix as pathnameWithoutLocale } from '@/lib/pathname-without-locale'

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

type SeoVariables = Record<string, string | number>

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
      return (current as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

function interpolateTemplate(template: string, variables: SeoVariables = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? String(variables[key]) : match
  })
}

function templateToSeoData(
  seoTemplate: unknown,
  variables: SeoVariables,
  fallback?: Partial<SEOData>,
): SEOData | null {
  if (!seoTemplate) {
    return fallback ? { ...fallback } : null
  }

  if (typeof seoTemplate === 'string') {
    return {
      title: interpolateTemplate(seoTemplate, variables),
      description: fallback?.description,
      ...fallback,
    }
  }

  if (typeof seoTemplate !== 'object') {
    return fallback ? { ...fallback } : null
  }

  const tpl = seoTemplate as Record<string, unknown>
  const result: SEOData = {}

  if (typeof tpl.title === 'string') {
    result.title = interpolateTemplate(tpl.title, variables)
  }
  if (typeof tpl.description === 'string') {
    result.description = interpolateTemplate(tpl.description, variables)
  }
  if (Array.isArray(tpl.keywords)) {
    result.keywords = tpl.keywords.map((keyword) =>
      typeof keyword === 'string' ? interpolateTemplate(keyword, variables) : String(keyword),
    )
  }
  if (typeof tpl.ogTitle === 'string') {
    result.ogTitle = interpolateTemplate(tpl.ogTitle, variables)
  }
  if (typeof tpl.ogDescription === 'string') {
    result.ogDescription = interpolateTemplate(tpl.ogDescription, variables)
  }
  if (typeof tpl.ogImage === 'string') {
    result.ogImage = interpolateTemplate(tpl.ogImage, variables)
  }
  if (typeof tpl.twitterTitle === 'string') {
    result.twitterTitle = interpolateTemplate(tpl.twitterTitle, variables)
  }
  if (typeof tpl.twitterDescription === 'string') {
    result.twitterDescription = interpolateTemplate(tpl.twitterDescription, variables)
  }
  if (typeof tpl.twitterImage === 'string') {
    result.twitterImage = interpolateTemplate(tpl.twitterImage, variables)
  }
  if (typeof tpl.canonical === 'string') {
    result.canonical = interpolateTemplate(tpl.canonical, variables)
  }

  return { ...fallback, ...result }
}

const COMMUNITY_SITE_NAME = 'Ring Platform'

function applyCloneSiteName(value: string | undefined, siteName: string): string | undefined {
  if (!value || !siteName || siteName === COMMUNITY_SITE_NAME) return value
  return value.replaceAll(COMMUNITY_SITE_NAME, siteName)
}

export async function resolveSeoData(
  locale: Locale,
  path: string,
  variables: SeoVariables = {},
  fallback?: Partial<SEOData>,
): Promise<SEOData | null> {
  setRequestLocale(locale)
  const messages = await getMessages()
  const seoRoot = messages.seo as Record<string, unknown> | undefined
  if (!seoRoot) {
    return fallback ? { ...fallback } : null
  }
  const seoTemplate = getNestedValue(seoRoot, path)
  if (!seoTemplate) {
    return fallback ? { ...fallback } : null
  }
  return templateToSeoData(seoTemplate, variables, fallback)
}

export type BuildLocalizedMetadataOptions = {
  locale: Locale
  path: string
  variables?: SeoVariables
  pathname?: string
  canonicalUrl?: string
  fallback?: Partial<SEOData>
  siteName?: string
  twitterSite?: string
  robots?: Metadata['robots']
}

export { getRingSeoBranding, getSiteBaseUrl }

export async function buildLocalizedMetadata(
  options: BuildLocalizedMetadataOptions,
): Promise<Metadata> {
  const branding = getRingSeoBranding()
  const {
    locale,
    path,
    variables = {},
    pathname,
    canonicalUrl,
    fallback,
    siteName = branding.siteName,
    twitterSite = branding.twitterSite,
    robots = { index: true, follow: true },
  } = options

  const seoData = await resolveSeoData(
    locale,
    path,
    { siteName, ...variables },
    fallback,
  )
  const brandedTitle = applyCloneSiteName(seoData?.title, siteName)
  const brandedDescription = applyCloneSiteName(seoData?.description, siteName)
  const brandedOgTitle = applyCloneSiteName(seoData?.ogTitle, siteName)
  const brandedOgDescription = applyCloneSiteName(seoData?.ogDescription, siteName)
  const brandedTwitterTitle = applyCloneSiteName(seoData?.twitterTitle, siteName)
  const brandedTwitterDescription = applyCloneSiteName(seoData?.twitterDescription, siteName)
  const baseUrl = getSiteBaseUrl()
  const canonical =
    canonicalUrl ??
    (seoData?.canonical
      ? seoData.canonical.startsWith('http')
        ? seoData.canonical
        : `${baseUrl}${seoData.canonical}`
      : pathname
        ? `${baseUrl}${withLocalePath(locale, pathname)}`
        : undefined)

  const ogImage = seoData?.ogImage ?? branding.ogImage

  return {
    title: brandedTitle,
    description: brandedDescription,
    keywords: seoData?.keywords?.map((keyword) => applyCloneSiteName(keyword, siteName) ?? keyword),
    robots,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title: brandedOgTitle ?? brandedTitle,
      description: brandedOgDescription ?? brandedDescription,
      url: canonical,
      type: 'website',
      siteName,
      locale: openGraphLocaleTag(locale),
      alternateLocale: openGraphAlternateLocaleTags(locale),
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      site: twitterSite,
      title: brandedTwitterTitle ?? brandedTitle,
      description: brandedTwitterDescription ?? brandedDescription,
      images: [seoData?.twitterImage ?? ogImage],
    },
  }
}
