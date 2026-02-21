import fs from 'fs'
import path from 'path'

export interface DocFilePathResult {
  filePath: string | null
  redirect?: string
}

/**
 * Resolves the file path for a documentation MDX file based on locale and slug
 * 
 * Handles various URL patterns:
 * - /docs/section -> library/section/index.mdx (with fallback to section.mdx)
 * - /docs/section/page -> library/section/page.mdx
 * - /docs/section/index -> redirect to /docs/section (canonical URL)
 * - /docs/library -> library/index.mdx
 * 
 * @param locale - The locale string (e.g., 'en', 'uk')
 * @param slug - The URL slug array
 * @param docsRoot - Optional custom docs root path (defaults to process.cwd()/docs/content)
 * @returns Object with filePath and optional redirect URL
 */
export function resolveDocFilePath(
  locale: string, 
  slug: string[],
  docsRoot?: string
): DocFilePathResult {
  const root = docsRoot || path.join(process.cwd(), 'docs', 'content')

  // Handle /docs/section/index -> redirect to /docs/section (canonical URL)
  if (slug.length >= 2 && slug[slug.length - 1] === 'index') {
    const redirectSlug = slug.slice(0, -1).join('/')
    return { filePath: null, redirect: `/${locale}/docs/${redirectSlug}` }
  }

  // Handle /docs/library special case
  if (slug.length === 1 && slug[0] === 'library') {
    return { filePath: path.join(root, locale, 'library', 'index.mdx') }
  }

  // Handle single segment: /docs/section -> try library/section/index.mdx first
  if (slug.length === 1) {
    const indexPath = path.join(root, locale, 'library', slug[0], 'index.mdx')
    const directPath = path.join(root, locale, 'library', slug[0] + '.mdx')

    if (fs.existsSync(indexPath)) {
      return { filePath: indexPath }
    }
    if (fs.existsSync(directPath)) {
      return { filePath: directPath }
    }
    // Return expected path for error message
    return { filePath: indexPath }
  }

  // Handle multi-segment: /docs/section/page -> library/section/page.mdx
  const filePath = path.join(root, locale, 'library', ...slug) + '.mdx'
  return { filePath }
}

/**
 * Simple version that just returns the file path without redirect handling
 * Use this when you only need the path and handle redirects separately
 * 
 * @param locale - The locale string (e.g., 'en', 'uk')
 * @param slug - The URL slug array
 * @returns The resolved file path string
 */
export function getDocFilePath(locale: string, slug: string[]): string {
  const result = resolveDocFilePath(locale, slug)
  return result.filePath || ''
}