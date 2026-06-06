import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import type { Metadata } from 'next'
import type { LocalePageProps } from '@/utils/page-props'
import { generateDocsMetadata, renderDocsPage } from '@/components/docs/docs-page-renderer'

type ConfidentialRoadmapPageParams = {
  locale: string
}

export async function generateMetadata({
  params,
}: {
  params: Promise<ConfidentialRoadmapPageParams>
}): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const locale = (routing.locales.includes(rawLocale as Locale) ? (rawLocale as Locale) : routing.defaultLocale) as Locale

  return generateDocsMetadata({ locale, slug: ['roadmap'], confidential: true })
}

export default async function ConfidentialRoadmapPage({ params }: LocalePageProps<ConfidentialRoadmapPageParams>) {
  const { locale: rawLocale } = await params
  const locale = (routing.locales.includes(rawLocale as Locale) ? (rawLocale as Locale) : routing.defaultLocale) as Locale

  return renderDocsPage({ locale, slug: ['roadmap'], confidential: true })
}

