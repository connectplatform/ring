import type { Metadata } from 'next'
import type { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale, type Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import Link from 'next/link'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RingBreadcrumbs } from '@/components/common/ring-breadcrumbs'
import { ROUTES } from '@/constants/routes'
import { getNftMarketCollections } from '@/features/nft-market/services/listing-query'

// Empty params type for future extensibility
type CollectionsParams = {}

// generateMetadata generates SEO metadata, resolving correct locale from params
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
    path: 'nft.collections',
    pathname: '/nft/collections',
  })
}

// The main collections page — gallery of all user-created NFT collections.
// FIX 2026-07-06: removed StoreWrapper (a store-specific wrapper that injected
//     onCountsUpdate/onPriceRangeUpdate callbacks via React.cloneElement onto
//     DOM <div> elements — React 19 warns about unknown DOM event handlers).
//     NFT pages do not need store filters, sorting, or price range callbacks.
export default async function CollectionsPage(props: LocalePageProps<CollectionsParams>) {
  const params = await props.params
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale
  setRequestLocale(locale)
  const collections = await getNftMarketCollections()

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 space-y-3">
        <RingBreadcrumbs
          items={[
            { label: 'NFT Exhibition', href: ROUTES.NFT_MARKET(locale) },
            { label: 'Collections' },
          ]}
        />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">NFT Collections</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Browse verified Ringdom KEYS collection aggregates and jump into filtered listings.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={ROUTES.NFT_MARKET(locale)}>Open marketplace</Link>
          </Button>
        </div>
      </div>

      {collections.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/50 p-10 text-center">
          <p className="font-medium">No collection aggregates yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Collections appear as soon as active listings refresh the marketplace cache.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => {
            const href = ROUTES.NFT_COLLECTION(collection.slug || collection.collection, locale)
            return (
              <Link key={collection.id} href={href} className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg">
                <div className="relative aspect-[4/3] bg-muted">
                  <Image
                    src={collection.imageUri || '/placeholder-product.png'}
                    alt={collection.name}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(min-width: 1024px) 33vw, 50vw"
                  />
                  <div className="absolute left-3 top-3">
                    <Badge>{collection.symbol}</Badge>
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <h2 className="font-semibold">{collection.name}</h2>
                    <p className="truncate font-mono text-xs text-muted-foreground">{collection.collection}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Listed</p>
                      <p className="font-semibold">{collection.activeListings}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Items</p>
                      <p className="font-semibold">{collection.itemCount ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Floor</p>
                      <p className="font-semibold">{collection.floorPriceRaw ? 'raw' : '—'}</p>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
