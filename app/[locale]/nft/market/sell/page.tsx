import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { auth } from '@/auth'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { listNftGateTemplatesResolved } from '@/features/nft-gates/config'
import { listActiveStakes } from '@/features/nft-gates/gate-escrow'
import { listOwnedGateAssets } from '@/features/nft-gates/purchase'
import { findActiveListingByAsset, isTradeableGateSlug } from '@/features/nft-market/listing-policy'
import { NftSellWizard } from '@/features/nft-market/components/nft-sell-wizard'
import { ROUTES } from '@/constants/routes'

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
    path: 'nft.market.sell',
    pathname: '/nft/market/sell',
    fallback: {
      title: 'Sell NFT Gate | Ring NFT Market',
      description: 'List an eligible Ringdom KEYS gate NFT for sale.',
    },
  })
}

export default async function NftMarketSellPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user?.id) {
    redirect(`${ROUTES.LOGIN(locale)}?callbackUrl=${encodeURIComponent(ROUTES.NFT_MARKET_SELL(locale))}`)
  }

  const [templates, owned, stakes] = await Promise.all([
    listNftGateTemplatesResolved(),
    listOwnedGateAssets(session.user.id),
    listActiveStakes(session.user.id),
  ])

  const stakedAssets = new Set(stakes.map((stake) => stake.asset))
  const eligibleOwned = []
  for (const item of owned) {
    if (!isTradeableGateSlug(item.slug)) continue
    if (item.soulbound || stakedAssets.has(item.asset)) continue
    const listed = await findActiveListingByAsset(item.asset)
    if (listed) continue
    eligibleOwned.push(item)
  }

  return (
    <NftSellWizard
      locale={locale}
      owned={eligibleOwned}
      templates={templates}
      username={session.user.username || session.user.name || undefined}
    />
  )
}
