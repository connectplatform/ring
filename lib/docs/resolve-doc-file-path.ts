import fs from 'fs'
import path from 'path'

export interface DocFilePathResult {
  filePath: string | null
  redirect?: string
}

/**
 * Resolves MDX under `docs/content/{locale}/library/**` while keeping public URLs
 * **without** the `library` segment (canonical: `/docs`, `/docs/getting-started`, …).
 *
 * Legacy `/docs/library/...` URLs redirect to `/docs/...` (or `/docs` for the hub).
 */
export function resolveDocFilePath(
  locale: string,
  slug: string[],
  docsRoot?: string,
): DocFilePathResult {
  const root = docsRoot || path.join(process.cwd(), 'docs', 'content')

  // Legacy: /docs/library[/...] → /docs[/...]
  if (slug.length >= 1 && slug[0] === 'library') {
    const rest = slug.slice(1)
    const target = rest.length === 0 ? `/${locale}/docs` : `/${locale}/docs/${rest.join('/')}`
    return { filePath: null, redirect: target }
  }

  // /docs/.../index → /docs/...
  if (slug.length >= 2 && slug[slug.length - 1] === 'index') {
    const redirectSlug = slug.slice(0, -1).join('/')
    return { filePath: null, redirect: `/${locale}/docs/${redirectSlug}` }
  }

  // /docs → library/index.mdx (same file as `app/(public)/[locale]/docs/page.tsx`)
  if (slug.length === 0) {
    return { filePath: path.join(root, locale, 'library', 'index.mdx') }
  }

  // /docs/section → library/section/index.mdx or library/section.mdx
  if (slug.length === 1) {
    const indexPath = path.join(root, locale, 'library', slug[0], 'index.mdx')
    const directPath = path.join(root, locale, 'library', slug[0] + '.mdx')

    if (fs.existsSync(indexPath)) {
      return { filePath: indexPath }
    }
    if (fs.existsSync(directPath)) {
      return { filePath: directPath }
    }
    return { filePath: indexPath }
  }

  // /docs/a/b/c → library/a/b/c.mdx
  const filePath = path.join(root, locale, 'library', ...slug) + '.mdx'
  return { filePath }
}

export function getDocFilePath(locale: string, slug: string[]): string {
  const result = resolveDocFilePath(locale, slug)
  return result.filePath || ''
}
