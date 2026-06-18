import fs from 'fs'
import path from 'path'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '@/lib/locale-config'

export interface DocFilePathResult {
  filePath: string | null
}

export interface DocsSectionMeta {
  title?: string
  description?: string
  pages?: string[]
}

/** Normalize optional catch-all param: `/docs` → `[]`. */
export function normalizeDocsSlug(slug: string[] | undefined): string[] {
  return slug ?? []
}

/** Physical MDX root: `docs/`. */
export function getDocsRoot(docsRoot?: string): string {
  return docsRoot ?? path.join(process.cwd(), 'docs')
}

export function getDocsLocaleRoot(locale: string, docsRoot?: string): string {
  return path.join(getDocsRoot(docsRoot), locale)
}

/**
 * Resolves MDX under `docs/{locale}/**`.
 * Contract: try `{slug}.mdx`, then `{slug}/index.mdx`; empty slug → `index.mdx`.
 * URL-shape redirects (`.mdx` suffix, trailing `/index`) live in `next.config.mjs`.
 */
export function resolveDocFilePath(
  locale: string,
  slug: string[],
): DocFilePathResult {
  const localeRoot = getDocsLocaleRoot(locale)

  if (slug.length === 0) {
    return { filePath: path.join(localeRoot, 'index.mdx') }
  }

  const directPath = path.join(localeRoot, ...slug) + '.mdx'
  const hubPath = path.join(localeRoot, ...slug, 'index.mdx')

  if (fs.existsSync(directPath)) {
    return { filePath: directPath }
  }
  if (fs.existsSync(hubPath)) {
    return { filePath: hubPath }
  }

  return { filePath: directPath }
}

export function getDocFilePath(locale: string, slug: string[]): string {
  return resolveDocFilePath(locale, slug).filePath ?? ''
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

export function readSectionMeta(metaPath: string): DocsSectionMeta {
  try {
    if (!fs.existsSync(metaPath)) return {}
    return JSON.parse(fs.readFileSync(metaPath, 'utf8')) as DocsSectionMeta
  } catch {
    return {}
  }
}

export function readLocaleSectionMeta(locale: string, sectionSlug: string): DocsSectionMeta {
  return readSectionMeta(path.join(getDocsLocaleRoot(locale), sectionSlug, 'meta.json'))
}

/** Static params for `docs/[[...slug]]` (slug segment only; locale comes from parent). */
export function scanDocsStaticParams(): { slug?: string[] }[] {
  const seen = new Set<string>()
  const params: { slug?: string[] }[] = []

  const add = (slug: string[]) => {
    const key = slug.length === 0 ? '__hub__' : slug.join('/')
    if (seen.has(key)) return
    seen.add(key)
    params.push(slug.length === 0 ? {} : { slug })
  }

  add([])

  for (const locale of SUPPORTED_LOCALES) {
    const localePath = getDocsLocaleRoot(locale)

    const scanDir = (dir: string, currentSlug: string[] = []): void => {
      if (!fs.existsSync(dir)) return

      for (const item of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, item)
        const stat = fs.statSync(fullPath)

        if (stat.isDirectory()) {
          const indexPath = path.join(fullPath, 'index.mdx')
          if (fs.existsSync(indexPath)) {
            add([...currentSlug, item])
          }
          scanDir(fullPath, [...currentSlug, item])
        } else if (item.endsWith('.mdx') && item !== 'index.mdx') {
          add([...currentSlug, item.replace(/\.mdx$/, '')])
        }
      }
    }

    scanDir(localePath)
  }

  return params
}

export type { Locale }
