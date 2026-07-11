import type { Metadata } from 'next'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { setRequestLocale } from 'next-intl/server'
import { auth } from '@/auth'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { isValidLocale, defaultLocale } from '@/i18n/shared'
import type { LocalePageProps } from '@/utils/page-props'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { listNftGateTemplatesResolved, isNftGatesEnabled } from '@/features/nft-gates/config'
import { listOwnedGateAssets } from '@/features/nft-gates/purchase'
import { listActiveStakes } from '@/features/nft-gates/gate-escrow'
import { getNativeTokenSymbol } from '@/lib/ring-config-chain'
import { NftGatesClient } from '@/components/nft/nft-gates-client'

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
    path: 'nft.gates',
    pathname: '/nft/gates',
  })
}

export default async function NftGatesPage(props: LocalePageProps) {
  await connection()
  const params = await props.params
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale
  setRequestLocale(locale)

  const session = await auth()
  const enabled = isNftGatesEnabled()
  const templates = enabled ? await listNftGateTemplatesResolved() : []
  const userId = session?.user?.id
  const [owned, stakes] = userId
    ? await Promise.all([listOwnedGateAssets(userId), listActiveStakes(userId)])
    : [[], []]

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">NFT Feature Gates</h1>
        <p className="text-muted-foreground max-w-2xl">
          Buy Metaplex Core gate NFTs with {getNativeTokenSymbol()}, then stake into GateEscrow to
          unlock membership and vendor features. Membership gates are soulbound; vendor keys are
          tradeable in a later market.
        </p>
        {!enabled && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            NFT gates are disabled in ring-config (`nft.enabled`).
          </p>
        )}
      </div>

      <Suspense fallback={<div className="text-muted-foreground">Loading gates…</div>}>
        <NftGatesClient
          locale={locale}
          templates={templates}
          owned={owned}
          stakes={stakes}
          tokenSymbol={getNativeTokenSymbol()}
          signedIn={Boolean(userId)}
        />
      </Suspense>
    </div>
  )
}
