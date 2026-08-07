/**
 * Hreflang SSOT — locale-path and absolute alternate maps.
 * Single origin via getSiteBaseUrl(); as-needed prefix (default locale unprefixed) + x-default.
 */

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale,
} from '@/lib/locale-config'
import { getSiteBaseUrl } from '@/lib/ring-config-core'

export function withLocalePath(locale: string, path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (locale === DEFAULT_LOCALE) {
    return normalized
  }
  return normalized === '/' ? `/${locale}` : `/${locale}${normalized}`
}

/** Relative path map: { en: '/about', uk: '/uk/about', 'x-default': '/about' }. */
export function generateHreflangAlternates(
  pathname: string,
  locales: readonly string[] = SUPPORTED_LOCALES,
): Record<string, string> {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`
  const alternates: Record<string, string> = {}

  for (const locale of locales) {
    alternates[locale] = withLocalePath(locale, normalized)
  }
  alternates['x-default'] = withLocalePath(DEFAULT_LOCALE, normalized)

  return alternates
}

/** Absolute URL map for the same path (one production origin). */
export function toAbsoluteHreflangMap(
  pathname: string,
  locales: readonly string[] = SUPPORTED_LOCALES,
): Record<string, string> {
  const base = getSiteBaseUrl().replace(/\/$/, '')
  const relative = generateHreflangAlternates(pathname, locales)
  const absolute: Record<string, string> = {}
  for (const [lang, path] of Object.entries(relative)) {
    absolute[lang] = path.startsWith('http') ? path : `${base}${path}`
  }
  return absolute
}

/**
 * Drop Link header entries that carry hreflang (Next promotes alternate links
 * into HTTP Link headers → nginx upstream buffer overflow / branded 503).
 */
export function stripHreflangLinkHeaderValue(linkHeader: string | null): string | null {
  if (!linkHeader) return null
  const kept = linkHeader
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !/hreflang\s*=/i.test(part))
  return kept.length > 0 ? kept.join(', ') : null
}

export function stripHreflangLinkHeaders(headers: Headers): void {
  const current = headers.get('link') ?? headers.get('Link')
  if (!current) return
  const next = stripHreflangLinkHeaderValue(current)
  headers.delete('link')
  headers.delete('Link')
  if (next) headers.set('link', next)
}

export type { Locale }
