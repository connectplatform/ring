import type { Metadata } from 'next'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import type { LocalePageProps } from '@/utils/page-props'
import { normalizeDocsSlug } from '@/lib/docs/docs-path'
import {
  generateDocsMetadata,
  generateDocsStaticParams,
  renderDocsPage,
} from '@/components/docs/docs-page-renderer'

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

  return renderDocsPage({ locale, slug: normalizeDocsSlug(slug) })
}
