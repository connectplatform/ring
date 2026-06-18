import type { Metadata } from 'next'
import { connection } from 'next/server'
import { setRequestLocale } from 'next-intl/server'
import AboutWrapper from '@/components/wrappers/about-wrapper'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { getRingConfigSnapshot, isRoadmapModuleEnabled } from '@/lib/ring-config-core'
import { getPrimaryFounderContact } from '@/lib/ring-widgets/resolve-config-contacts'
import type { LocalePageProps } from '@/utils/page-props'
import { AboutClient } from './about-client'

type AboutParams = Record<string, never>

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
    path: 'about',
    pathname: '/about',
  })
}

export default async function AboutPage(props: LocalePageProps<AboutParams>) {
  await connection()

  const { locale: localeParam } = await props.params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  setRequestLocale(locale)

  const config = getRingConfigSnapshot()
  const roadmapEnabled = isRoadmapModuleEnabled(config)
  const displayName = config.clone?.displayName ?? 'Ring Platform'
  const primaryFounder = getPrimaryFounderContact()

  return (
    <AboutWrapper locale={locale}>
      <AboutClient
        key={locale}
        roadmapEnabled={roadmapEnabled}
        displayName={displayName}
        primaryFounder={primaryFounder}
      />
    </AboutWrapper>
  )
}
