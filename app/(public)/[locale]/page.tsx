import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata, getSeoSiteBaseUrl, RING_PLATFORM_SEO } from '@/lib/seo-metadata'
import { LocalePageProps } from '@/utils/page-props'
import HomeWrapper from '@/components/wrappers/home-wrapper'
import { ROUTES } from '@/constants/routes'
import { JsonLd } from '@/components/seo/json-ld'

type HomePageParams = Record<string, never>

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
    path: 'home',
    variables: { platform: RING_PLATFORM_SEO.siteName },
    pathname: '/',
    siteName: RING_PLATFORM_SEO.siteName,
    twitterSite: RING_PLATFORM_SEO.twitterSite,
  })
}

/**
 * Marketing home — static shell (no connection/auth/cookies).
 * Session-specific UI lives in Navigation / sidebar client islands.
 */
export default async function HomePage({ params }: LocalePageProps<HomePageParams>) {
  const resolvedParams = await params
  const locale = routing.locales.includes(resolvedParams.locale as Locale)
    ? resolvedParams.locale
    : routing.defaultLocale

  setRequestLocale(locale)

  const baseUrl = getSeoSiteBaseUrl()
  const websiteJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: RING_PLATFORM_SEO.siteName,
    description:
      'Connect, collaborate, and create value in the decentralized economy. Professional networking, opportunities, and blockchain-enabled collaboration.',
    url: `${baseUrl}${ROUTES.HOME(locale as Locale)}`,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}${ROUTES.OPPORTUNITIES(locale as Locale)}?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
    publisher: {
      '@type': 'Organization',
      name: RING_PLATFORM_SEO.siteName,
      url: baseUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/logo.svg`,
      },
    },
    inLanguage: locale,
  }

  return (
    <>
      <JsonLd id={`ring-home-website-jsonld-${locale}`} data={websiteJsonLd} />
      <HomeWrapper />
    </>
  )
}
