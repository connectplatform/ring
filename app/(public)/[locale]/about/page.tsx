import type { Metadata } from 'next'
import { Suspense } from 'react'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import AboutWrapper from '@/components/wrappers/about-wrapper'
import { LocalePageProps } from '@/utils/page-props'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata, getSeoSiteBaseUrl, RING_PLATFORM_SEO } from '@/lib/seo-metadata'
import { connection } from 'next/server'

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
    siteName: RING_PLATFORM_SEO.siteName,
    twitterSite: RING_PLATFORM_SEO.twitterSite,
  })
}

export default async function AboutPage(props: LocalePageProps<AboutParams>) {
  await connection()

  const { locale: localeParam } = await props.params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  const t = await getTranslations('about')
  const baseUrl = getSeoSiteBaseUrl()
  const jsonLdData = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    url: `${baseUrl}/about`,
    name: t('title'),
    description: t('description'),
    inLanguage: locale,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdData) }}
      />
      <Suspense
        fallback={
          <div className="flex justify-center items-center h-screen">
            <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900" />
          </div>
        }
      >
        <AboutWrapper locale={locale}>
          <div className="p-6">
            <h1 className="text-3xl font-bold mb-4">{t('title')}</h1>
            <p className="text-muted-foreground">{t('description')}</p>
          </div>
        </AboutWrapper>
      </Suspense>
    </>
  )
}
