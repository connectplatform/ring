import type { Metadata } from 'next'
import type { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale, type Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { loadTranslations } from '@/i18n/load-translations'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { connection } from 'next/server'

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
  const t = await loadTranslations(locale)

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {t.modules.nft.collections.title}
        </h1>
        <p className="text-muted-foreground">
          {t.modules.nft.collections.subtitle}
        </p>
      </div>

      {/* TODO: Replace with actual collection gallery grid once the collections
           query (listCollections) is implemented. See features/nft-market/ for
           the adapter + service layer. */}
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <p className="text-muted-foreground">
          {t.modules.nft.collections.comingSoon}
        </p>
      </div>
    </div>
  )
}
