import 'server-only'

import type { Metadata } from 'next'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { defaultLocale, type Locale } from '@/i18n/shared'
import { getRingSeoBranding, getSiteBaseUrl } from '@/lib/ring-config'

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

function withLocalePath(locale: Locale, path: string): string {
  if (locale === defaultLocale) {
    return path
  }
  return path === '/' ? `/${locale}` : `/${locale}${path}`
}

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

/** @deprecated Use getSiteBaseUrl() from @/lib/ring-config */
export { getSiteBaseUrl as getSeoSiteBaseUrl }

/** Strip `/uk`, `/ru`, … prefix for hreflang path generation. */
export function pathnameWithoutLocale(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length > 0 && routing.locales.includes(segments[0] as Locale)) {
    const rest = segments.slice(1).join('/')
    return rest ? `/${rest}` : '/'
  }
  return pathname.startsWith('/') ? pathname : `/${pathname}`
}

export function generateHreflangAlternates(
  pathname: string,
  locales: readonly Locale[] = routing.locales,
): Record<string, string> {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`
  const alternates: Record<string, string> = {}

  for (const locale of locales) {
    alternates[locale] = withLocalePath(locale, normalized)
  }
  alternates['x-default'] = withLocalePath(defaultLocale, normalized)

  return alternates
}

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

  const seoData = await resolveSeoData(locale, path, variables, fallback)
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

  const ogLocale = locale === 'uk' ? 'uk_UA' : 'en_US'
  const ogImage = seoData?.ogImage ?? branding.ogImage

  return {
    title: seoData?.title,
    description: seoData?.description,
    keywords: seoData?.keywords,
    robots,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title: seoData?.ogTitle ?? seoData?.title,
      description: seoData?.ogDescription ?? seoData?.description,
      url: canonical,
      type: 'website',
      siteName,
      locale: ogLocale,
      alternateLocale: locale === 'uk' ? ['en_US'] : ['uk_UA'],
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      site: twitterSite,
      title: seoData?.twitterTitle ?? seoData?.title,
      description: seoData?.twitterDescription ?? seoData?.description,
      images: [seoData?.twitterImage ?? ogImage],
    },
  }
}

/** @deprecated Use `buildLocalizedMetadata` in `generateMetadata` instead. */
export async function getSEOMetadata(
  locale: Locale,
  path: string,
  variables: SeoVariables = {},
  fallback?: Partial<SEOData>,
): Promise<SEOData | null> {
  return resolveSeoData(locale, path, variables, fallback)
}

export function getDefaultSEOData(locale: Locale): SEOData {
  const branding = getRingSeoBranding()
  return {
    title: `${branding.siteName} - Decentralized Opportunities & Professional Networking`,
    description:
      'Connect, collaborate, and create value in the decentralized economy. Join Ring Platform for professional networking, opportunities, and blockchain-enabled collaboration.',
    keywords: ['decentralized', 'opportunities', 'blockchain', 'collaboration', 'web3', branding.siteName],
    canonical: locale === defaultLocale ? '/' : `/${locale}`,
    ogTitle: `${branding.siteName} - Decentralized Professional Networking`,
    ogDescription: 'Discover and create opportunities in the decentralized economy',
    ogImage: branding.ogImage,
    twitterTitle: branding.siteName,
    twitterDescription: 'Decentralized opportunities and collaboration platform',
    twitterImage: branding.ogImage,
  }
}
