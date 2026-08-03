import 'server-only'
import fs from 'fs'
import matter from 'gray-matter'
import { calculateReadingTime } from '@/features/news/utils/reading-time'
import {
  buildDocsLinkPath,
  getDocsLocaleRoot,
  joinDocsFsPath,
  readSectionMeta,
  resolveDocFilePath,
} from '@/lib/docs/docs-path'

export interface DocsFrontmatter {
  title?: string
  description?: string
  last_modified?: string
  audience?: string
  keywords?: string[] | string
}

export interface DocsBreadcrumbItem {
  label: string
  /** `null` = current article title (plain text, not a link). */
  href: string | null
}

export interface DocsArticleContext {
  title: string
  lastModified: string | null
  readingTime: { minutes: number; text: string }
  breadcrumbs: DocsBreadcrumbItem[]
  slug: string[]
}

function slugToLabel(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** SSOT: read MDX frontmatter + body from disk. */
export function readDocMatter(
  filePath: string,
): { data: DocsFrontmatter; content: string } | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null
    }
    const parsed = matter(fs.readFileSync(filePath, 'utf8'))
    return { data: parsed.data as DocsFrontmatter, content: parsed.content }
  } catch {
    return null
  }
}

/** SSOT title from MDX frontmatter — shared with docs-navigation-tree. */
export function getDocTitleFromFile(filePath: string, fallback: string): string {
  const doc = readDocMatter(filePath)
  if (doc?.data.title && typeof doc.data.title === 'string') {
    return doc.data.title
  }
  return fallback
}

function stripMdxForReadingEstimate(content: string): string {
  return content
    .replace(/<[^>]+>/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\{`[\s\S]*?`\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function breadcrumbLabelForSegment(locale: string, slugPrefix: string[]): string {
  const segment = slugPrefix[slugPrefix.length - 1]
  const localeRoot = getDocsLocaleRoot(locale)
  const sectionMeta = readSectionMeta(joinDocsFsPath(localeRoot, ...slugPrefix, 'meta.json'))
  if (sectionMeta.title) {
    return sectionMeta.title
  }
  const indexPath = joinDocsFsPath(localeRoot, ...slugPrefix, 'index.mdx')
  return getDocTitleFromFile(indexPath, slugToLabel(segment))
}

/** Build breadcrumb trail: Docs → section(s) → article title. */
export function buildDocsBreadcrumbs(
  locale: string,
  slug: string[],
  articleTitle: string,
  docsRootLabel = 'Docs',
): DocsBreadcrumbItem[] {
  const items: DocsBreadcrumbItem[] = [{ label: docsRootLabel, href: buildDocsLinkPath([]) }]

  for (let i = 0; i < slug.length; i += 1) {
    const accumulated = slug.slice(0, i + 1)
    const isLast = i === slug.length - 1

    if (isLast) {
      items.push({ label: articleTitle, href: null })
      continue
    }

    items.push({
      label: breadcrumbLabelForSegment(locale, accumulated),
      href: buildDocsLinkPath(accumulated),
    })
  }

  return items
}

/** Load article shell context. Returns `null` for `/docs` hub (empty slug). */
export function loadDocsArticleContext(
  locale: string,
  slug: string[],
  docsRootLabel = 'Docs',
): DocsArticleContext | null {
  if (slug.length === 0) {
    return null
  }

  const { filePath } = resolveDocFilePath(locale, slug)
  if (!filePath) {
    return null
  }

  const doc = readDocMatter(filePath)
  if (!doc) {
    return null
  }

  const pageSlug = slug[slug.length - 1]
  const title = doc.data.title ?? slugToLabel(pageSlug)
  const readingTime = calculateReadingTime(stripMdxForReadingEstimate(doc.content))
  const lastModified =
    typeof doc.data.last_modified === 'string' ? doc.data.last_modified : null

  return {
    title,
    lastModified,
    readingTime,
    breadcrumbs: buildDocsBreadcrumbs(locale, slug, title, docsRootLabel),
    slug,
  }
}

export function formatDocsLastModified(isoDate: string, locale: string): string {
  try {
    const parsed = new Date(isoDate.includes('T') ? isoDate : `${isoDate}T12:00:00`)
    if (Number.isNaN(parsed.getTime())) {
      return isoDate
    }
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(parsed)
  } catch {
    return isoDate
  }
}
