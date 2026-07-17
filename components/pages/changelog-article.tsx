'use client'

import { cn } from '@/lib/utils'
import { davinciGlassSurface } from '@/lib/ui/davinci'
import { MarkdownRenderer } from '@/components/docs/markdown-renderer'

/** Horizontal inset for text — mirrors about-publisher's compact form/legal recipe. */
const INSET = 'px-4 sm:px-5 lg:px-6'

export interface ChangelogArticleProps {
  html: string
  title: string
  subtitle: string
  brandLabel?: string
}

/** Center-pane changelog: rendered markdown article (no docs-style copy control). */
export function ChangelogArticle({
  html,
  title,
  subtitle,
  brandLabel = 'Ring Platform',
}: ChangelogArticleProps) {
  return (
    <article className={cn('mx-auto w-full max-w-3xl py-6 sm:py-8', INSET)}>
      <header className="mb-5 space-y-1.5 border-b border-border/60 pb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {brandLabel}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </header>

      <div className={cn(davinciGlassSurface, 'changelog-article px-4 py-3 sm:px-5')}>
        <MarkdownRenderer htmlContent={html} />
      </div>
    </article>
  )
}
