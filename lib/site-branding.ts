import { routing } from '@/i18n/routing'
import { blogArticlePathname } from '@/lib/blog/blog-path'

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '')
}

/** Canonical public origin (clone-safe via env). */
export function getSiteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    'https://ringplatform.org'
  return stripTrailingSlash(raw)
}

export function getBrandName(): string {
  return process.env.NEXT_PUBLIC_BRAND_NAME || 'Ring Platform'
}

export function getBrandTagline(): string {
  return process.env.NEXT_PUBLIC_BRAND_TAGLINE || ''
}

export function getBrandLogoPath(): string {
  return process.env.NEXT_PUBLIC_BRAND_LOGO || '/images/logo.png'
}

export function getBrandOgImagePath(): string {
  return process.env.NEXT_PUBLIC_BRAND_OG_IMAGE || '/og-image.png'
}

export function getNewsSectionLabel(): string {
  return process.env.NEXT_PUBLIC_NEWS_SECTION_LABEL || `${getBrandName()} News`
}

export function absoluteSiteUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${getSiteOrigin()}${normalized}`
}

export function localeNewsArticleUrl(locale: string, slug: string): string {
  return absoluteSiteUrl(`/${locale}/news/${slug}`)
}

export function localeBlogArticleUrl(locale: string, username: string, slug: string): string {
  return absoluteSiteUrl(`/${locale}${blogArticlePathname(username, slug)}`)
}

/** Absolute hreflang map for a locale-agnostic path (e.g. `/news/my-slug`). */
export function buildAbsoluteHreflang(pathname: string): Record<string, string> {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`
  const origin = getSiteOrigin()
  const languages: Record<string, string> = {}
  for (const loc of routing.locales) {
    languages[loc] = `${origin}/${loc}${normalized}`
  }
  return languages
}

/** Resolve relative image paths against the public site origin. */
export function resolvePublicImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return absoluteSiteUrl(url.startsWith('/') ? url : `/${url}`)
}
