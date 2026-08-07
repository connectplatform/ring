import type { WikiPage } from '@/features/wiki/types'
import { slugifyTitle } from '@/features/wiki/vault-key'

/** Leaf slug hint for `path/slug` or title-like targets. */
export function wikiTargetSlugHint(target: string): string {
  const t = target.trim()
  if (!t) return 'page'
  if (t.includes('/')) {
    const leaf = t.split('/').filter(Boolean).pop() || t
    return slugifyTitle(leaf)
  }
  return slugifyTitle(t)
}

/**
 * Resolve a wikilink target against an in-memory page list.
 * Prefers path/slug, then slug, then title / aliases.
 */
export function findPageByWikiTarget(
  pages: WikiPage[],
  target: string,
): WikiPage | null {
  const t = target.trim().toLowerCase()
  if (!t) return null
  const slugHint = wikiTargetSlugHint(target)

  return (
    pages.find((p) => `${p.path}/${p.slug}`.toLowerCase() === t) ||
    pages.find((p) => p.slug === t || p.slug === slugHint) ||
    pages.find((p) => p.title.toLowerCase() === t) ||
    pages.find((p) =>
      (p.frontmatter.aliases || []).some((a) => a.toLowerCase() === t),
    ) ||
    null
  )
}
