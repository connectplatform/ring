import fs from 'fs'
import path from 'path'
import {
  buildDocsHref,
  buildDocsLinkPath,
  getDocsLocaleRoot,
  readSectionMeta,
  resolveDocFilePath,
} from '@/lib/docs/docs-path'
import { getDocTitleFromFile } from '@/lib/docs/docs-article'

export interface DocsLinkSuggestion {
  title: string
  href: string
  slug: string[]
}

/** True when the resolved MDX file exists on disk. */
export function docExists(locale: string, slug: string[]): boolean {
  const { filePath } = resolveDocFilePath(locale, slug)
  return Boolean(filePath && fs.existsSync(filePath))
}

function slugToLabel(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** Top-level doc section slugs from locale meta.json + filesystem scan. */
export function getDocsSectionSlugs(locale: string): string[] {
  const localeRoot = getDocsLocaleRoot(locale)
  if (!fs.existsSync(localeRoot)) return []

  const meta = readSectionMeta(path.join(localeRoot, 'meta.json'))
  const fromMeta = meta.pages ?? []
  const seen = new Set<string>(fromMeta)

  for (const item of fs.readdirSync(localeRoot)) {
    const fullPath = path.join(localeRoot, item)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory() && !item.startsWith('.')) {
      seen.add(item)
    } else if (item.endsWith('.mdx') && item !== 'index.mdx') {
      seen.add(item.replace(/\.mdx$/, ''))
    }
  }

  return [...seen]
}

export function isValidDocsSection(locale: string, sectionSlug: string | undefined): boolean {
  if (!sectionSlug) return false
  return getDocsSectionSlugs(locale).includes(sectionSlug)
}

function resolveDocLink(
  locale: string,
  slug: string[],
): DocsLinkSuggestion | null {
  const { filePath } = resolveDocFilePath(locale, slug)
  if (!filePath || !fs.existsSync(filePath)) return null

  const fallback = slugToLabel(slug[slug.length - 1] ?? 'docs')
  return {
    title: getDocTitleFromFile(filePath, fallback),
    href: buildDocsHref(locale, slug),
    slug,
  }
}

/** Filesystem fallback: up to `limit` pages in a docs section. */
export function listDocsInSection(
  locale: string,
  sectionSlug: string,
  limit = 6,
): DocsLinkSuggestion[] {
  const localeRoot = getDocsLocaleRoot(locale)
  const sectionDir = path.join(localeRoot, sectionSlug)
  const suggestions: DocsLinkSuggestion[] = []
  const seen = new Set<string>()

  const pushSlug = (slug: string[]) => {
    const key = slug.join('/')
    if (seen.has(key)) return
    const link = resolveDocLink(locale, slug)
    if (!link) return
    seen.add(key)
    suggestions.push(link)
  }

  const sectionMeta = readSectionMeta(path.join(sectionDir, 'meta.json'))
  for (const page of sectionMeta.pages ?? []) {
    if (suggestions.length >= limit) break
    pushSlug([sectionSlug, page])
  }

  if (fs.existsSync(path.join(sectionDir, 'index.mdx'))) {
    pushSlug([sectionSlug])
  }

  if (fs.existsSync(sectionDir) && suggestions.length < limit) {
    for (const item of fs.readdirSync(sectionDir)) {
      if (suggestions.length >= limit) break
      if (!item.endsWith('.mdx') || item === 'index.mdx') continue
      pushSlug([sectionSlug, item.replace(/\.mdx$/, '')])
    }
  }

  return suggestions.slice(0, limit)
}

/** Root-level popular entry points when section is unknown. */
export function listDocsRootSuggestions(locale: string, limit = 6): DocsLinkSuggestion[] {
  const seeds: string[][] = [
    [],
    ['welcome'],
    ['getting-started'],
    ['architecture'],
    ['features'],
    ['deployment'],
  ]

  const suggestions: DocsLinkSuggestion[] = []
  for (const slug of seeds) {
    if (suggestions.length >= limit) break
    const link = resolveDocLink(locale, slug)
    if (link) suggestions.push(link)
  }

  return suggestions.slice(0, limit)
}

export function buildDocsPublicPath(locale: string, slug: string[]): string {
  return buildDocsHref(locale, slug)
}

export function buildDocsLinkPathForSlug(slug: string[]): string {
  return buildDocsLinkPath(slug)
}
