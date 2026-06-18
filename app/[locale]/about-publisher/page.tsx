import type { Metadata } from 'next'
import { connection } from 'next/server'
import { setRequestLocale } from 'next-intl/server'
import { AboutPublisherClient } from './about-publisher-client'
import AboutWrapper from '@/components/wrappers/about-wrapper'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import type { LocalePageProps } from '@/utils/page-props'
import { getPrimaryFounderContact } from '@/lib/ring-widgets/resolve-config-contacts'

type AboutPublisherParams = Record<string, never>

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
    path: 'about-publisher',
    pathname: '/about-publisher',
  })
}

export default async function AboutPublisherPage(props: LocalePageProps<AboutPublisherParams>) {
  await connection()

  const { locale: localeParam } = await props.params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  setRequestLocale(locale)

  const primaryFounder = getPrimaryFounderContact()

  return (
    <AboutWrapper locale={locale}>
      <AboutPublisherClient key={locale} primaryFounder={primaryFounder} />
    </AboutWrapper>
  )
}
