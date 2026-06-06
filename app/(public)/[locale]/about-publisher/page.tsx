import { Metadata } from 'next';
import { OG_RING_PLATFORM_ABOUT_PUBLISHER_JPG } from '@/lib/og-assets';
import { buildMessages } from '@/lib/i18n';
import { AboutPublisherClient } from './about-publisher-client';
import AboutWrapper from '@/components/wrappers/about-wrapper'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import type { LocalePageProps } from '@/utils/page-props'

type AboutPublisherParams = { locale: string }

export async function generateMetadata({ params }: { params: Promise<AboutPublisherParams> }): Promise<Metadata> {
  const { locale } = await params;
  const messages = await buildMessages(locale);
  const t = messages['about-publisher'] || {};

  return {
    title: t.title || 'Sonoratek LLC — Ring platform publisher',
    description: t.description || 'Sonoratek LLC (Tempe, Arizona) is Ringdom\'s domestic LLC and the legal publisher of Ring — with gratitude for everyone who helped Ukraine prove its right to independence 🇺🇦.',
    keywords: ['Sonoratek LLC', 'Ringdom', 'Ring Platform', 'Open Source', 'AI', 'Web3', 'Collaboration'],
    openGraph: {
      title: t.title || 'Sonoratek LLC — Ring platform publisher',
      description: t.description || 'Sonoratek LLC (Tempe, Arizona) is Ringdom\'s domestic LLC and the legal publisher of Ring — with gratitude for everyone who helped Ukraine prove its right to independence 🇺🇦.',
      type: 'website',
      images: [
        {
          url: OG_RING_PLATFORM_ABOUT_PUBLISHER_JPG,
          width: 1200,
          height: 630,
          alt: t.title || 'Sonoratek LLC — Ring platform publisher',
        },
      ],
    },
  };
}

export default async function AboutPublisherPage(props: LocalePageProps<AboutPublisherParams>) {
  const params = await props.params
  const locale = routing.locales.includes(params.locale as Locale) ? params.locale : routing.defaultLocale

  return (
    <AboutWrapper locale={locale}>
      <AboutPublisherClient />
    </AboutWrapper>
  )
}