import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import {
  getNftMarketCollections,
  getNftMarketListings,
} from '@/features/nft-market/services/listing-query'
import {
  NftMarketWrapper,
  normalizeNftMarketSort,
  type NftMarketFilters,
} from '@/features/nft-market/components/nft-market-wrapper'

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function parseFilters(searchParams: Record<string, string | string[] | undefined>): NftMarketFilters {
  return {
    q: firstParam(searchParams.q)?.trim() || '',
    collection: firstParam(searchParams.collection)?.trim() || '',
    slug: firstParam(searchParams.slug)?.trim() || '',
    sort: normalizeNftMarketSort(firstParam(searchParams.sort)),
  }
}

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
    path: 'nft.market',
    pathname: '/nft/market',
    fallback: {
      title: 'NFT Exhibition Marketplace | Ring Platform',
      description: 'Trade verified Ringdom KEYS gate NFTs with RING.',
    },
  })
}

export default async function NftMarketPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ locale: localeParam }, sp] = await Promise.all([params, searchParams])
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const filters = parseFilters(sp)
  const [initialPage, collections] = await Promise.all([
    getNftMarketListings({
      q: filters.q || undefined,
      collection: filters.collection || undefined,
      slug: filters.slug || undefined,
      sort: filters.sort,
      status: 'active',
      limit: 24,
    }),
    getNftMarketCollections(),
  ])

  return (
    <NftMarketWrapper
      locale={locale}
      initialFilters={filters}
      initialPage={initialPage}
      collections={collections}
    />
  )
}
