import type { Metadata } from 'next'
import type { LocalePageProps } from '@/utils/page-props'
import type { Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import StoreWrapper from '@/components/wrappers/store-wrapper'
import { buildLocalizedMetadata, RING_PLATFORM_SEO } from '@/lib/seo-metadata'

type CollectionParams = { slug: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale: localeParam, slug } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'nft.collection',
    pathname: `/nft/collections/${slug}`,
    variables: { slug },
    siteName: RING_PLATFORM_SEO.siteName,
    twitterSite: RING_PLATFORM_SEO.twitterSite,
  })
}

export default async function CollectionPage(props: LocalePageProps<CollectionParams>) {
  const params = await props.params
  const locale = routing.locales.includes(params.locale as Locale) ? params.locale : routing.defaultLocale
  const { slug } = params
  const t = await getTranslations('nft.collection')
  
  return (
    <StoreWrapper locale={locale as Locale}>
      <div className="container mx-auto px-0 py-0">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('metadata.title') || 'Collection'}: {slug}
          </h1>
          <p className="text-muted-foreground">
            {t('metaDescription.subtitle') || 'Subtitle'}
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground">
            {t('metadata.comingSoon') || 'Coming soon'}
          </p>
        </div>
      </div>
    </StoreWrapper>
  )
}


