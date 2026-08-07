import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import {
  getNftMarketCollectionBySlugOrId,
  getNftMarketCollections,
  getNftMarketListings,
} from '@/features/nft-market/services/listing-query'
import { NftMarketWrapper } from '@/features/nft-market/components/nft-market-wrapper'

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

  setRequestLocale(locale)
  const collection = await getNftMarketCollectionBySlugOrId(slug)
  if (!collection) notFound()

  const [initialPage, collections] = await Promise.all([
    getNftMarketListings({
      collection: collection.collection,
      status: 'active',
      sort: 'newest',
      limit: 24,
    }),
    getNftMarketCollections(),
  ])

  return (
    <NftMarketWrapper
      locale={locale}
      initialFilters={{
        q: '',
        collection: collection.collection,
        slug: '',
        sort: 'newest',
      }}
      initialPage={initialPage}
      collections={collections}
    />
  )
}
