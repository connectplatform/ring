'use client'

import { useActionState, useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { CheckCircle2, KeyRound, ShieldCheck, Store, XCircle } from 'lucide-react'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import { RingBreadcrumbs } from '@/components/common/ring-breadcrumbs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DavinciGlassPanel } from '@/lib/ui/davinci'
import { purchaseGateListingAction, cancelGateListingAction } from '@/app/_actions/nft-market'
import { stakeGateAction } from '@/app/_actions/nft-gates'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import type { NftGateSlug } from '@/features/nft-gates/types'
import type { NftMarketCollection, NftMarketListing } from '@/features/nft-market/types'
import { NftListingCard, formatRemainingTerm } from './nft-listing-card'
import { nativeTokenRawToUi } from '@/lib/wallet/native-token-amount'

function formatFloorRing(floorPriceRaw: string | undefined, decimals: number) {
  if (!floorPriceRaw) return null
  try {
    return nativeTokenRawToUi(BigInt(floorPriceRaw), decimals)
  } catch {
    return null
  }
}

export function NftListingRightSidebar({
  locale,
  listing,
  collection,
  relatedListings,
}: {
  locale: Locale
  listing: NftMarketListing
  collection: NftMarketCollection | null
  relatedListings: NftMarketListing[]
}) {
  return (
    <div className="space-y-4">
      <DavinciGlassPanel>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Store className="h-5 w-5 text-[var(--davinci-beam)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">Seller</p>
            <p className="truncate font-semibold">
              {listing.sellerUsername ? `@${listing.sellerUsername.replace(/^@/, '')}` : 'Ring seller'}
            </p>
            {listing.sellerWallet ? (
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{listing.sellerWallet}</p>
            ) : null}
          </div>
        </div>
      </DavinciGlassPanel>

      <DavinciGlassPanel title="Collection stats">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-muted-foreground">Symbol</p>
            <p className="font-semibold">{collection?.symbol || listing.collectionSymbol || 'KEYS'}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-muted-foreground">Listed</p>
            <p className="font-semibold">{collection?.activeListings ?? '—'}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-muted-foreground">Floor</p>
            <p className="font-semibold">
              {(() => {
                const floor = formatFloorRing(collection?.floorPriceRaw, listing.decimals)
                return floor ? `${floor} RING` : `${listing.priceRing} RING`
              })()}
            </p>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-muted-foreground">Items</p>
            <p className="font-semibold">{collection?.itemCount ?? '—'}</p>
          </div>
        </div>
        {collection ? (
          <Button asChild variant="outline" className="mt-4 w-full">
            <Link href={ROUTES.NFT_COLLECTION(collection.slug || collection.collection, locale)}>
              View collection
            </Link>
          </Button>
        ) : null}
      </DavinciGlassPanel>

      <DavinciGlassPanel title="Related listings">
        {relatedListings.length ? (
          <div className="space-y-3">
            {relatedListings.slice(0, 3).map((item) => (
              <NftListingCard key={item.id} listing={item} locale={locale} compact />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No related listings yet.</p>
        )}
      </DavinciGlassPanel>
    </div>
  )
}

function ListingActions({
  listing,
  isSeller,
  signedIn,
}: {
  listing: NftMarketListing
  isSeller: boolean
  signedIn: boolean
}) {
  const [purchaseState, purchaseAction, purchasePending] = useActionState(purchaseGateListingAction, null)
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelGateListingAction, null)
  const [stakeMessage, setStakeMessage] = useState<string | null>(null)
  const [stakeError, setStakeError] = useState<string | null>(null)
  const [isStaking, startStaking] = useTransition()
  const [idempotencyKey] = useState(() => {
    const random = globalThis.crypto?.randomUUID?.()
    return random || `purchase_${Date.now()}_${Math.random().toString(36).slice(2)}`
  })

  const canBuy = signedIn && !isSeller && listing.status === 'active'
  const canCancel = signedIn && isSeller && (listing.status === 'active' || listing.status === 'draft')
  const purchased = purchaseState?.success
  const isMemberLane = listing.lane === 'member'
  const purchaseSuccessMessage = isMemberLane
    ? purchaseState?.message || 'Purchased. Ownership transferred — no stake required for member mints.'
    : purchaseState?.message || 'Purchased. Stake it to activate gate benefits.'

  return (
    <div className="space-y-3">
      {!signedIn ? (
        <Alert>
          <AlertDescription>Sign in to buy or manage this listing.</AlertDescription>
        </Alert>
      ) : null}

      {purchaseState?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{purchaseState.error}</AlertDescription>
        </Alert>
      ) : null}
      {cancelState?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{cancelState.error}</AlertDescription>
        </Alert>
      ) : null}
      {purchaseState?.success ? (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{purchaseSuccessMessage}</AlertDescription>
        </Alert>
      ) : null}
      {stakeError ? (
        <Alert variant="destructive">
          <AlertDescription>{stakeError}</AlertDescription>
        </Alert>
      ) : null}
      {stakeMessage ? (
        <Alert>
          <AlertDescription>{stakeMessage}</AlertDescription>
        </Alert>
      ) : null}

      {canBuy && !purchased ? (
        <form action={purchaseAction}>
          <input type="hidden" name="listingId" value={listing.id} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <Button type="submit" disabled={purchasePending} className="w-full">
            {purchasePending ? 'Purchasing...' : `Buy for ${listing.priceRing} ${listing.currency}`}
          </Button>
        </form>
      ) : null}

      {purchased && !isMemberLane ? (
        <Button
          type="button"
          className="w-full"
          disabled={isStaking}
          onClick={() => {
            setStakeError(null)
            setStakeMessage(null)
            startStaking(async () => {
              const result = await stakeGateAction(listing.asset, listing.slug as NftGateSlug)
              if (result.success) {
                setStakeMessage('Gate staked and feature access activated.')
              } else {
                setStakeError(result.error || 'Failed to stake gate')
              }
            })
          }}
        >
          {isStaking ? 'Staking...' : 'Stake to activate'}
        </Button>
      ) : null}

      {purchased && isMemberLane ? (
        <Button asChild variant="outline" className="w-full">
          <Link href={ROUTES.NFT_MARKET()}>Back to market</Link>
        </Button>
      ) : null}

      {canCancel ? (
        <form action={cancelAction}>
          <input type="hidden" name="listingId" value={listing.id} />
          <Button type="submit" variant="destructive" disabled={cancelPending} className="w-full">
            {cancelPending ? 'Cancelling...' : 'Cancel listing'}
          </Button>
        </form>
      ) : null}
    </div>
  )
}

export function NftListingDetailsWrapper({
  locale,
  listing,
  collection,
  relatedListings,
  currentUserId,
}: {
  locale: Locale
  listing: NftMarketListing
  collection: NftMarketCollection | null
  relatedListings: NftMarketListing[]
  currentUserId?: string
}) {
  const isSeller = Boolean(currentUserId && currentUserId === listing.sellerUserId)
  const image = listing.imageUri || '/placeholder-product.png'

  const rightRail = (
    <NftListingRightSidebar
      locale={locale}
      listing={listing}
      collection={collection}
      relatedListings={relatedListings}
    />
  )

  return (
    <RingRightRailLayout
      showRightRail
      flushCenterPane
      mobileRailMode="consecutive"
      rightRailPurpose="nft-listing"
      rightRail={rightRail}
    >
      <DavinciCenterPane contentClassName="space-y-8">
        <RingBreadcrumbs
          items={[
            { label: 'NFT Exhibition', href: ROUTES.NFT_MARKET(locale) },
            ...(collection
              ? [{ label: collection.symbol, href: ROUTES.NFT_COLLECTION(collection.slug || collection.collection, locale) }]
              : []),
            { label: listing.name },
          ]}
        />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <div className="space-y-4">
          <div className="relative aspect-square overflow-hidden rounded-3xl border bg-muted">
            <Image src={image} alt={listing.name} fill className="object-cover" sizes="(min-width: 1024px) 50vw, 100vw" />
          </div>
          {listing.showcase?.animationUrl ? (
            <div className="overflow-hidden rounded-2xl border bg-card/70 p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Animation
              </p>
              <video
                src={listing.showcase.animationUrl}
                controls
                playsInline
                className="aspect-video w-full rounded-xl bg-black object-contain"
              />
            </div>
          ) : null}
          {listing.showcase?.ringShowcase?.media && listing.showcase.ringShowcase.media.length > 1 ? (
            <div className="grid grid-cols-4 gap-2">
              {listing.showcase.ringShowcase.media
                .filter((m) => m.enabled)
                .map((m) => (
                  <div key={m.id} className="relative aspect-square overflow-hidden rounded-lg border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.webpUrl || m.originalUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
            </div>
          ) : null}
        </div>

          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge>{listing.collectionSymbol || (listing.lane === 'member' ? 'MEMBER' : 'KEYS')}</Badge>
              {listing.lane === 'member' ? (
                <Badge variant="secondary">Member collection</Badge>
              ) : (
                <Badge className="bg-emerald-700 text-white">KEYS verified</Badge>
              )}
              <Badge variant="outline">{listing.status}</Badge>
              <Badge variant="secondary">{listing.mode}</Badge>
            </div>

            <div>
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-primary">
                {listing.lane === 'member' ? 'Member mint' : listing.slug}
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-5xl">{listing.name}</h1>
              {listing.description ? (
                <p className="mt-4 text-muted-foreground">{listing.description}</p>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border bg-card/70 p-4">
                <KeyRound className="mb-2 h-5 w-5 text-primary" />
                <p className="text-xs text-muted-foreground">
                  {listing.lane === 'member' ? 'Access' : 'Term'}
                </p>
                <p className="font-semibold">
                  {listing.lane === 'member'
                    ? 'Ownership only'
                    : formatRemainingTerm(listing.licenseExpiresAt)}
                </p>
              </div>
              <div className="rounded-2xl border bg-card/70 p-4">
                <ShieldCheck className="mb-2 h-5 w-5 text-primary" />
                <p className="text-xs text-muted-foreground">
                  {listing.lane === 'member' ? 'Lane' : 'Verified collection'}
                </p>
                <p className="font-semibold">
                  {listing.lane === 'member'
                    ? 'Open member'
                    : listing.collectionSymbol || 'KEYS'}
                </p>
              </div>
              <div className="rounded-2xl border bg-card/70 p-4">
                <XCircle className="mb-2 h-5 w-5 text-primary" />
                <p className="text-xs text-muted-foreground">Fee</p>
                <p className="font-semibold">{listing.feeBps / 100}%</p>
              </div>
            </div>

            <div className="rounded-3xl border bg-card/80 p-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Current price</p>
                  <p className="text-4xl font-bold text-primary">
                    {listing.priceRing} {listing.currency}
                  </p>
                </div>
                <p className="max-w-[14rem] text-right text-xs text-muted-foreground">
                  {listing.lane === 'member'
                    ? 'RING settlement for member-created Metaplex Core assets. No GateEscrow stake.'
                    : 'RING settlement, verified Solana KEYS gate listing.'}
                </p>
              </div>
              <div className="mt-5">
                <ListingActions listing={listing} isSeller={isSeller} signedIn={Boolean(currentUserId)} />
              </div>
            </div>
          </div>
        </div>
      </DavinciCenterPane>
    </RingRightRailLayout>
  )
}
