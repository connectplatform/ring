import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { auth } from '@/auth'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { getListingById } from '@/features/nft-market/services/listing-service'
import {
  getNftMarketCollectionBySlugOrId,
  getNftMarketListings,
} from '@/features/nft-market/services/listing-query'
import { NftListingDetailsWrapper } from '@/features/nft-market/components/nft-listing-details-wrapper'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; listingId: string }>
}): Promise<Metadata> {
  const { locale: localeParam, listingId } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const result = await getListingById(listingId)
  const listing = result.data

  return buildLocalizedMetadata({
    locale,
    path: 'nft.market.listing',
    pathname: `/nft/market/${listingId}`,
    variables: { name: listing?.name || listingId },
    fallback: {
      title: `${listing?.name || 'NFT listing'} | Ring NFT Market`,
      description: listing?.description || 'Verified Ringdom KEYS marketplace listing.',
    },
  })
}

export default async function NftListingPage({
  params,
}: {
  params: Promise<{ locale: string; listingId: string }>
}) {
  const { locale: localeParam, listingId } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const result = await getListingById(listingId)
  if (!result.success || !result.data) notFound()

  const listing = result.data
  const [session, collection] = await Promise.all([
    auth(),
    listing.collection ? getNftMarketCollectionBySlugOrId(listing.collection) : Promise.resolve(null),
  ])
  const relatedPage = await getNftMarketListings({
    collection: listing.collection,
    slug: listing.slug,
    status: 'active',
    limit: 4,
  })

  return (
    <NftListingDetailsWrapper
      locale={locale}
      listing={listing}
      collection={collection}
      relatedListings={relatedPage.items.filter((item) => item.id !== listing.id)}
      currentUserId={session?.user?.id}
    />
  )
}
