import { profileArticlePathname } from '@/lib/blog/blog-path'
import { toAbsoluteHreflangMap, withLocalePath } from '@/lib/hreflang'
import {
  getPlatformIdentity,
  getSystemConfigSnapshot,
  getRingSeoBranding,
  getSiteBaseUrl,
} from '@/lib/ring-config-core'

/** Canonical public origin (clone-safe via env + ring-config). */
export function getSiteOrigin(): string {
  return getSiteBaseUrl()
}

export function getBrandName(): string {
  return process.env.NEXT_PUBLIC_BRAND_NAME || getPlatformIdentity().name
}

export function getBrandTagline(): string {
  return process.env.NEXT_PUBLIC_BRAND_TAGLINE || ''
}

export function getBrandLogoPath(): string {
  const branding = getSystemConfigSnapshot().branding as { logo?: { light?: string } } | undefined
  return (
    process.env.NEXT_PUBLIC_BRAND_LOGO ||
    branding?.logo?.light ||
    '/images/logo.png'
  )
}

export function getBrandOgImagePath(): string {
  return process.env.NEXT_PUBLIC_BRAND_OG_IMAGE || getRingSeoBranding().ogImage
}

export function getNewsSectionLabel(): string {
  return process.env.NEXT_PUBLIC_NEWS_SECTION_LABEL || `${getBrandName()} News`
}

export function absoluteSiteUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${getSiteOrigin()}${normalized}`
}

export function localeNewsArticleUrl(locale: string, slug: string): string {
  return absoluteSiteUrl(withLocalePath(locale, `/news/${slug}`))
}

export function localeBlogArticleUrl(locale: string, username: string, slug: string): string {
  return absoluteSiteUrl(withLocalePath(locale, profileArticlePathname(username, slug)))
}

/** Absolute hreflang map for a locale-agnostic path (e.g. `/news/my-slug`). */
export function buildAbsoluteHreflang(pathname: string): Record<string, string> {
  return toAbsoluteHreflangMap(pathname)
}

/** Resolve relative image paths against the public site origin. */
export function resolvePublicImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return absoluteSiteUrl(url.startsWith('/') ? url : `/${url}`)
}
