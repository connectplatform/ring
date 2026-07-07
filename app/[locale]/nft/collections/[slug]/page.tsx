import type { Metadata } from 'next'
import type { Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'

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
  })
}

// Single NFT collection detail page.
// FIX 2026-07-06: removed StoreWrapper (store-specific) — this page renders a
//     native <div> as children, and StoreWrapper.cloneElement was spreading
//     onCountsUpdate/onPriceRangeUpdate onto the DOM element.
export default async function CollectionPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale: localeParam, slug } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  const t = await getTranslations('nft.collection')

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {t('metadata.title') || 'Collection'}: {slug}
        </h1>
        <p className="text-muted-foreground">
          {t('metaDescription.subtitle') || 'Subtitle'}
        </p>
      </div>

      {/* TODO: Replace with actual collection items grid (NFT cards) once the
           collection detail query is implemented. See features/nft-market/adapters/
           for chain-specific NFT metadata + ownership resolution. */}
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <p className="text-muted-foreground">
          {t('metadata.comingSoon') || 'Coming soon'}
        </p>
      </div>
    </div>
  )
}
