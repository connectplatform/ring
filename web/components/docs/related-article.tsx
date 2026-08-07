import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { buildDocsLinkPath } from '@/lib/docs/docs-path-url'
import { resolveDocFilePath } from '@/lib/docs/docs-path'
import { getDocTitleFromFile } from '@/lib/docs/docs-article'

export interface RelatedDocsProps {
  children: ReactNode
  /** Optional heading override (default: Related documentation) */
  title?: string
  className?: string
}

export interface RelatedArticleProps {
  /**
   * Library-relative slug (no locale, no `.mdx`, no `/docs` prefix).
   * Examples: `features/admin`, `features/owner-project-lab`, `development/ring-mcp`
   */
  slug: string
  /**
   * Reader-facing reason to continue — why this article helps next.
   * Prefer one concrete sentence (not a bare enum label).
   */
  relation: string
  /** Override resolved frontmatter title when needed */
  title?: string
}

function normalizeLibrarySlug(slug: string): string[] {
  const cleaned = slug
    .trim()
    .replace(/^\/+/, '')
    .replace(/^docs\//, '')
    .replace(/\.mdx$/i, '')
    .replace(/\/index$/i, '')
  return cleaned.split('/').filter(Boolean)
}

function fallbackTitle(parts: string[]): string {
  const last = parts[parts.length - 1] || 'Article'
  return last
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Related-article card: resolves Article Title from MDX frontmatter via `slug`,
 * shows `relation` as the reason to keep reading.
 *
 * Relation guidance (Ring docs SSOT — free text, reader-first):
 * - Write a concrete “why continue” sentence for the reader.
 * - Prefer verbs from the Ring relation tree when helpful:
 *   prerequisite | next-step | deep-dive | same-workflow | depends-on | see-also
 *   (embed the verb naturally inside the sentence — do not use bare enum alone).
 */
export function RelatedArticle({ slug, relation, title }: RelatedArticleProps) {
  const parts = normalizeLibrarySlug(slug)
  const href = buildDocsLinkPath(parts)
  const { filePath } = resolveDocFilePath('en', parts)
  const resolvedTitle =
    title ||
    (filePath ? getDocTitleFromFile(filePath, fallbackTitle(parts)) : fallbackTitle(parts))

  return (
    <Link
      href={href}
      data-related-slug={parts.join('/')}
      className="group flex flex-col rounded-lg border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/30"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-foreground group-hover:text-primary">
          {resolvedTitle}
        </h3>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{relation}</p>
    </Link>
  )
}

/** Grid wrapper for RelatedArticle children — preferred over bare Cards for “see also”. */
export function RelatedDocs({
  children,
  title = 'Related documentation',
  className,
}: RelatedDocsProps) {
  return (
    <section className={`my-10 ${className ?? ''}`.trim()}>
      <h2 className="mb-4 text-2xl font-bold tracking-tight text-foreground scroll-mt-20">
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}
