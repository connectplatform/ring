import type { ComponentProps } from 'react'
import { after } from 'next/server'
import { Link } from '@/i18n/routing'
import { Calendar, Clock } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import {
  formatDocsLastModified,
  loadDocsArticleContext,
  type DocsBreadcrumbItem,
} from '@/lib/docs/docs-article'
import {
  ensureDocsArticleEnrichmentBackground,
  getDocsArticleMediaStatus,
} from '@/lib/docs/docs-article-enrichment'
import { DocsArticleBackButton } from '@/components/docs/docs-article-back-button'
import { DocsArticleMediaActions } from '@/components/docs/docs-article-media-actions'

type DocsLinkHref = ComponentProps<typeof Link>['href']

type DocsArticleShellProps = {
  locale: string
  slug: string[]
  showOnDesktop?: boolean
}

function DocsArticleBreadcrumbs({ items }: { items: DocsBreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 ? (
                <span className="text-muted-foreground/60" aria-hidden>
                  /
                </span>
              ) : null}
              {item.href && !isLast ? (
                <Link
                  href={item.href as DocsLinkHref}
                  className="truncate hover:text-foreground"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className="truncate font-medium text-foreground"
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/**
 * Docs center-pane article chrome: back + breadcrumbs, meta row, separators.
 * Hidden on `/docs` hub (empty slug) per doc-system contract.
 * On first load, schedules audible + NODUS enrichment via `after()` when missing.
 */
export async function DocsArticleShell({
  locale: rawLocale,
  slug,
  showOnDesktop = true,
}: DocsArticleShellProps) {
  const locale = (routing.locales.includes(rawLocale as Locale)
    ? (rawLocale as Locale)
    : routing.defaultLocale) as Locale

  const t = await getTranslations({ locale, namespace: 'docs.article' })

  const article = loadDocsArticleContext(locale, slug, t('docsRoot'))
  if (!article) {
    return null
  }
  const formattedDate = article.lastModified
    ? formatDocsLastModified(article.lastModified, locale)
    : null

  const mediaStatus = await getDocsArticleMediaStatus({
    locale,
    slug: article.slug,
  })

  if (mediaStatus?.shouldEnrich) {
    after(() =>
      ensureDocsArticleEnrichmentBackground({
        locale,
        slug: article.slug,
        title: article.title,
      }),
    )
  }

  return (
    <header
      className={`sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm ${showOnDesktop ? '' : 'lg:hidden'}`}
      data-docs-article-shell
    >
      <div className="container mx-auto space-y-0 px-4">
        <div
          className="article-top-nav-row flex items-center gap-3 py-3"
          data-docs-article-top-nav
        >
          <DocsArticleBackButton label={t('back')} />
          <DocsArticleBreadcrumbs items={article.breadcrumbs} />
        </div>

        <hr className="border-border" />

        <div
          className="article-meta-row flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm text-muted-foreground"
          data-docs-article-meta
        >
          <div className="flex flex-wrap items-center gap-4">
            {formattedDate ? (
              <span className="inline-flex items-center gap-1.5" data-last-modified>
                <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <time dateTime={article.lastModified ?? undefined}>
                  {t('lastModified', { date: formattedDate })}
                </time>
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5" data-listen-minutes>
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {t('listenMinutes', { minutes: article.readingTime.minutes })}
            </span>
          </div>
          <DocsArticleMediaActions
            slug={article.slug}
            title={article.title}
            initialStatus={mediaStatus}
          />
        </div>

        <hr className="border-border" />
      </div>
    </header>
  )
}
