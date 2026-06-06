import type { Metadata } from 'next'
import PrivacyPolicy from '@/features/privacy/components/privacy-policy'
import { LocalePageProps } from '@/utils/page-props'
import type { Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { buildLocalizedMetadata, RING_PLATFORM_SEO } from '@/lib/seo-metadata'
import { setRequestLocale } from 'next-intl/server'
import { connection } from 'next/server'

type PrivacyParams = Record<string, never>

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'privacy',
    pathname: '/privacy',
    siteName: RING_PLATFORM_SEO.siteName,
    twitterSite: RING_PLATFORM_SEO.twitterSite,
  })
}

export default async function PrivacyPage(props: LocalePageProps<PrivacyParams>) {
  await connection()
  await props.params
  return <PrivacyPolicy />
}
