import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import type { Metadata } from 'next'
import type { LocalePageProps } from '@/utils/page-props'
import { generateDocsMetadata, renderDocsPage } from '@/components/docs/docs-page-renderer'

type ConfidentialRoadmapChildrenParams = {
  locale: string
  slug: string[]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<ConfidentialRoadmapChildrenParams>
}): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params
  const locale = (routing.locales.includes(rawLocale as Locale) ? (rawLocale as Locale) : routing.defaultLocale) as Locale
  const segments = ['roadmap', ...(Array.isArray(slug) ? slug : [])]

  return generateDocsMetadata({ locale, slug: segments, confidential: true })
}

export default async function ConfidentialRoadmapChildrenPage({
  params,
}: LocalePageProps<ConfidentialRoadmapChildrenParams>) {
  const { locale: rawLocale, slug } = await params
  const locale = (routing.locales.includes(rawLocale as Locale) ? (rawLocale as Locale) : routing.defaultLocale) as Locale
  const roadmapSegments = ['roadmap', ...(Array.isArray(slug) ? slug : [])]

  return renderDocsPage({ locale, slug: roadmapSegments, confidential: true })
}

