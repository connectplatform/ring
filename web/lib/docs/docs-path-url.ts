/**
 * Pure docs URL / slug helpers — no fs, no process.cwd.
 * Keep Server Component layouts and client nav free of NFT filesystem traces.
 */

import { DEFAULT_LOCALE, type Locale } from '@/lib/locale-config'

/** Normalize optional catch-all param: `/docs` → `[]`. */
export function normalizeDocsSlug(slug: string[] | undefined): string[] {
  return slug ?? []
}

/** `features/erp/index.mdx` → `['features','erp']`; `welcome.mdx` → `['welcome']`. */
export function slugFromDocRelativePath(relativePath: string): string[] {
  const normalized = relativePath.replace(/\\/g, '/').replace(/\.mdx$/, '')
  if (normalized === 'index' || normalized.endsWith('/index')) {
    const withoutIndex = normalized.replace(/\/?index$/, '')
    return withoutIndex ? withoutIndex.split('/') : []
  }
  return normalized.split('/').filter(Boolean)
}

/** Locale-neutral path for next-intl `Link` (routing adds `/uk`, `/ru`, etc.). */
export function buildDocsLinkPath(slug: string[]): string {
  if (slug.length === 0) {
    return '/docs'
  }
  return `/docs/${slug.join('/')}`
}

/** Public docs href with `localePrefix: as-needed` (default locale omits `/en`). */
export function buildDocsHref(locale: string, slug: string[]): string {
  const prefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`
  return `${prefix}${buildDocsLinkPath(slug)}`
}

/** Public markdown twin path: `/docs/foo` → `/docs/foo.md` (locale-aware). */
export function buildDocsMarkdownHref(locale: string, slug: string[]): string {
  return `${buildDocsHref(locale, slug)}.md`
}

export type { Locale }
