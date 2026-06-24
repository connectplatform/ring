import { buildDocsLinkPath } from '@/lib/docs/docs-path'
import { stripLocalePrefix } from '@/lib/pathname-without-locale'

/** Locale-neutral docs hub — `docs/index.mdx` at `/docs`. */
export const DOCS_HUB_PATH = buildDocsLinkPath([])

function normalizePath(path: string): string {
  const withoutQuery = path.split('?')[0]?.split('#')[0] ?? path
  const trimmed = withoutQuery.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

/** Strip locale prefix for docs sidebar active matching (client + server safe). */
export function normalizeDocsNavPath(pathname: string): string {
  return normalizePath(stripLocalePrefix(pathname))
}

/**
 * Whether `href` should appear active for the current docs route.
 * - Exact match always wins.
 * - `/docs` hub is exact-only (never prefix-matches `/docs/features/...`).
 * - Section hubs may prefix-match their children.
 */
export function isDocsNavItemActive(activePath: string, href: string): boolean {
  const current = normalizePath(activePath)
  const target = normalizePath(href)

  if (current === target) {
    return true
  }

  if (target === DOCS_HUB_PATH) {
    return false
  }

  return current.startsWith(`${target}/`)
}

/**
 * Build sidebar href for a page slug under an optional section.
 * SSOT for docs-navigation-tree pinned + section items.
 */
export function buildDocsPageHref(sectionSlug: string | null, pageSlug: string): string {
  if (sectionSlug === null) {
    if (pageSlug === 'index') {
      return buildDocsLinkPath([])
    }
    return buildDocsLinkPath([pageSlug])
  }

  if (pageSlug === 'index') {
    return buildDocsLinkPath([sectionSlug])
  }

  return buildDocsLinkPath([sectionSlug, pageSlug])
}
