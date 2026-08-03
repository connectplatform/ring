import type { Metadata } from 'next'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import type { LocalePageProps } from '@/utils/page-props'
import { normalizeDocsSlug } from '@/lib/docs/docs-path-url'
import {
  generateDocsMetadata,
  generateDocsStaticParams,
  renderDocsPage,
} from '@/components/docs/docs-page-renderer'
import { DocsNotFound } from '@/components/docs/docs-not-found'
import { DocsArticleShell } from '@/components/docs/docs-article-shell'

type PageParams = {
  locale: string
  slug?: string[]
}

export async function generateMetadata({ params }: { params: Promise<PageParams> }): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params
  const locale = (routing.locales.includes(rawLocale as Locale)
    ? (rawLocale as Locale)
    : routing.defaultLocale) as Locale

  return generateDocsMetadata({ locale, slug: normalizeDocsSlug(slug) })
}

export { generateDocsStaticParams as generateStaticParams }

export default async function DocPage({ params }: LocalePageProps<PageParams>) {
  const { locale: rawLocale, slug } = await params
  const locale = (routing.locales.includes(rawLocale as Locale)
    ? (rawLocale as Locale)
    : routing.defaultLocale) as Locale
  const normalizedSlug = normalizeDocsSlug(slug)

  const result = await renderDocsPage({ locale, slug: normalizedSlug })

  if (result.status === 'not_found') {
    return (
      <DocsNotFound
        locale={result.locale}
        slug={result.slug}
        reason={result.reason}
        categoryValid={result.categoryValid}
        path={result.path}
      />
    )
  }

  return (
    <>
      <DocsArticleShell locale={locale} slug={normalizedSlug} showOnDesktop />
      {result.content}
    </>
  )
}
