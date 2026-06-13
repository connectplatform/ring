import fs from 'fs'
import path from 'path'

export interface DocFilePathResult {
  filePath: string | null
  redirect?: string
}

/** Physical MDX root: `docs/content/{locale}/` (retired `library/` segment). */
export function getDocsLocaleRoot(locale: string, docsRoot?: string): string {
  return path.join(docsRoot ?? path.join(process.cwd(), 'docs', 'content'), locale)
}

function normalizeSlugSegment(segment: string): string {
  return segment.endsWith('.mdx') ? segment.slice(0, -4) : segment
}

function normalizeDocsSlug(slug: string[]): string[] {
  return slug.map(normalizeSlugSegment)
}

/**
 * Resolves MDX under `docs/content/{locale}/**`.
 * Public URLs omit the retired `library` segment (canonical: `/docs`, `/docs/getting-started`, …).
 *
 * Legacy `/docs/library/...` and `*.mdx` URL suffixes redirect to canonical paths.
 */
export function resolveDocFilePath(
  locale: string,
  slug: string[],
  docsRoot?: string,
): DocFilePathResult {
  const root = docsRoot ?? path.join(process.cwd(), 'docs', 'content')
  const localeRoot = getDocsLocaleRoot(locale, root)

  // Legacy: /docs/library[/...] → /docs[/...]
  if (slug.length >= 1 && slug[0] === 'library') {
    const rest = normalizeDocsSlug(slug.slice(1))
    const target = rest.length === 0 ? `/${locale}/docs` : `/${locale}/docs/${rest.join('/')}`
    return { filePath: null, redirect: target }
  }

  const normalized = normalizeDocsSlug(slug)
  if (normalized.join('/') !== slug.join('/')) {
    const target =
      normalized.length === 0 ? `/${locale}/docs` : `/${locale}/docs/${normalized.join('/')}`
    return { filePath: null, redirect: target }
  }

  // /docs/.../index → /docs/...
  if (normalized.length >= 2 && normalized[normalized.length - 1] === 'index') {
    const redirectSlug = normalized.slice(0, -1).join('/')
    return { filePath: null, redirect: `/${locale}/docs/${redirectSlug}` }
  }

  // /docs → index.mdx
  if (normalized.length === 0) {
    return { filePath: path.join(localeRoot, 'index.mdx') }
  }

  // /docs/section → section/index.mdx or section.mdx
  if (normalized.length === 1) {
    const indexPath = path.join(localeRoot, normalized[0], 'index.mdx')
    const directPath = path.join(localeRoot, `${normalized[0]}.mdx`)

    if (fs.existsSync(indexPath)) {
      return { filePath: indexPath }
    }
    if (fs.existsSync(directPath)) {
      return { filePath: directPath }
    }
    return { filePath: indexPath }
  }

  // /docs/a/b/c → a/b/c.mdx
  const filePath = path.join(localeRoot, ...normalized) + '.mdx'
  return { filePath }
}

export function getDocFilePath(locale: string, slug: string[]): string {
  const result = resolveDocFilePath(locale, slug)
  return result.filePath || ''
}
