import React from 'react'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { FileQuestion, Home, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, Cards } from '@/components/docs/card'
import type { Locale } from '@/i18n/shared'
import {
  buildDocsLinkPathForSlug,
  type DocsLinkSuggestion,
} from '@/lib/docs/docs-sections'
import {
  getPopularDocsInCategory,
  recordDocs404,
  recordDocsUnknownCategorySecurityEvent,
} from '@/features/analytics/lib/docs-analytics'

export interface DocsNotFoundProps {
  locale: Locale
  slug: string[]
  reason: 'missing_file' | 'invalid_path'
  categoryValid: boolean
  path: string
}

export async function DocsNotFound({
  locale,
  slug,
  reason,
  categoryValid,
  path,
}: DocsNotFoundProps) {
  const t = await getTranslations({ locale, namespace: 'docs.notFound' })
  const category = slug[0] ?? null

  await recordDocs404({
    locale,
    slug,
    path,
    reason,
    categoryValid,
  })

  if (!categoryValid && category) {
    await recordDocsUnknownCategorySecurityEvent({
      locale,
      slug,
      path,
      category,
    })
  }

  const suggestions: DocsLinkSuggestion[] = categoryValid && category
    ? await getPopularDocsInCategory(locale, category, 6)
    : await getPopularDocsInCategory(locale, null, 6)

  const sectionHref = category && categoryValid
    ? (buildDocsLinkPathForSlug([category]) as '/docs')
    : ('/docs' as const)

  return (
    <div className="w-full h-full py-8 px-4 md:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="rounded-xl border border-border bg-muted/20 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <FileQuestion className="h-7 w-7 text-muted-foreground" aria-hidden />
          </div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {t('badge')}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-foreground md:text-3xl">
            {t('title')}
          </h1>
          <p className="mt-3 text-muted-foreground">{t('description')}</p>
          <p className="mt-2 break-all font-mono text-xs text-muted-foreground/80">
            {path}
          </p>
          {!categoryValid && category ? (
            <p className="mt-4 text-sm text-amber-700 dark:text-amber-400">
              {t('unknownSection', { section: category })}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="default">
              <Link href="/docs">
                <Home className="mr-2 h-4 w-4" />
                {t('backToDocs')}
              </Link>
            </Button>
            {categoryValid && category ? (
              <Button asChild variant="outline">
                <Link href={sectionHref}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t('browseSection')}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        {suggestions.length > 0 ? (
          <section>
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              {categoryValid && category
                ? t('popularInSection', { section: category })
                : t('popularDocs')}
            </h2>
            <Cards>
              {suggestions.map((item) => (
                <Card
                  key={item.href}
                  title={item.title}
                  href={buildDocsLinkPathForSlug(item.slug)}
                >
                  {t('readArticle')}
                </Card>
              ))}
            </Cards>
          </section>
        ) : null}
      </div>
    </div>
  )
}
