import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import type { NftMarketListing } from '@/features/nft-market/types'

function formatSeller(listing: NftMarketListing) {
  if (listing.sellerUsername) return `@${listing.sellerUsername.replace(/^@/, '')}`
  if (listing.sellerWallet) return `${listing.sellerWallet.slice(0, 4)}...${listing.sellerWallet.slice(-4)}`
  return 'Ring seller'
}

export function formatRemainingTerm(expiresAt?: string | null) {
  if (!expiresAt) return 'Lifetime / open term'

  const ms = new Date(expiresAt).getTime() - Date.now()
  if (!Number.isFinite(ms)) return 'Term available'
  if (ms <= 0) return 'Expired'

  const days = Math.ceil(ms / 86_400_000)
  if (days >= 365) return `${Math.ceil(days / 365)}y remaining`
  if (days >= 30) return `${Math.ceil(days / 30)}mo remaining`
  return `${days}d remaining`
}

export function NftListingCard({
  listing,
  locale,
  compact = false,
}: {
  listing: NftMarketListing
  locale: Locale
  compact?: boolean
}) {
  const href = ROUTES.NFT_MARKET_LISTING(listing.id, locale)
  const image = listing.imageUri || '/placeholder-product.png'

  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-2xl border bg-card/80 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <Image
          src={image}
          alt={listing.name}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes={compact ? '160px' : '(min-width: 1024px) 280px, 50vw'}
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <Badge className="bg-black/70 text-white backdrop-blur">
            {listing.collectionSymbol || (listing.lane === 'member' ? 'MEMBER' : 'KEYS')}
          </Badge>
          {listing.lane === 'member' ? (
            <Badge variant="secondary">Member</Badge>
          ) : (
            <Badge className="bg-emerald-700/90 text-white">KEYS verified</Badge>
          )}
          {listing.status !== 'active' ? (
            <Badge variant="secondary">{listing.status}</Badge>
          ) : null}
        </div>
      </div>

      <div className={compact ? 'space-y-2 p-3' : 'space-y-3 p-4'}>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {listing.lane === 'member' ? listing.collectionName || 'Member collection' : listing.slug}
          </p>
          <h3 className="line-clamp-2 font-semibold leading-tight">{listing.name}</h3>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">
            {listing.lane === 'member' ? 'Creator mint' : formatRemainingTerm(listing.licenseExpiresAt)}
          </span>
          <span className="truncate text-muted-foreground">{formatSeller(listing)}</span>
        </div>

        <div className="flex items-end justify-between gap-3 border-t pt-3">
          <span className="text-xs text-muted-foreground">Price</span>
          <span className="text-lg font-bold text-primary">
            {listing.priceRing} {listing.currency}
          </span>
        </div>
      </div>
    </Link>
  )
}
