import type { Metadata } from 'next'
import { getSiteBaseUrl } from '@/lib/ring-config'
import { buildMessages } from '@/lib/i18n'
import { generateHreflangAlternates } from '@/lib/seo-metadata'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '@/lib/locale-config'
import { RoadmapPage } from '@/components/pages/roadmap-page'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const locale = (SUPPORTED_LOCALES as readonly string[]).includes(rawLocale)
    ? (rawLocale as Locale)
    : DEFAULT_LOCALE
  const messages = await buildMessages(locale, 'public')
  const section = (messages.roadmap ?? {}) as { title?: string; description?: string }
  const base = getSiteBaseUrl()

  return {
    title: section.title ?? 'Ring Platform Roadmap',
    description:
      section.description ??
      'Platform roadmap for founders and CTOs — shipped capabilities, RING token economy, and documentation.',
    keywords: [
      'Ring Platform',
      'roadmap',
      'RING token',
      'white-label',
      'founders',
      'CTO',
      'LegioX',
    ],
    alternates: {
      canonical: `${base}/${DEFAULT_LOCALE}/roadmap`,
      languages: generateHreflangAlternates('/roadmap', SUPPORTED_LOCALES),
    },
    openGraph: {
      title: section.title,
      description: section.description,
      url: `${base}/${locale}/roadmap`,
      type: 'website',
    },
  }
}

export default function PublicRoadmapPage() {
  return <RoadmapPage />
}
