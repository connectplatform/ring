import type { Metadata } from 'next'
import type { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale, type Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { loadTranslations } from '@/i18n/load-translations'
import { setRequestLocale } from 'next-intl/server'
import StoreWrapper from '@/components/wrappers/store-wrapper'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'

// Define route params structure for type safety
type ItemParams = { chain: string; contract: string; tokenId: string }

// Generates localized metadata for the NFT item page
// Uses Next.js 13+/16 dynamic metadata API
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; chain: string; contract: string; tokenId: string }>
}): Promise<Metadata> {
  // Await params object, destructure out values
  const { locale: localeParam, chain, contract, tokenId } = await params

  // Determine valid locale, fallback to default if not recognized
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  // Set the request-level locale for next-intl (SSR)
  setRequestLocale(locale)

  // Build and return SEO metadata for this NFT item page
  return buildLocalizedMetadata({
    locale,
    path: 'nft.item',
    pathname: `/nft/items/${chain}/${contract}/${tokenId}`,
    variables: { chain, contract, tokenId },
  })
}

// Main page component for showing NFT item details
// TODO: Use React server components (RSC) features for async data, e.g. React 19's use() for data instead of await if/when supported in Next.
// TODO: Destructure props directly in function params for clearer code if supported by page routers.
export default async function ItemPage(props: LocalePageProps<ItemParams>) {
  // Retrieve the route params (might be a promise due to Next.js dynamic routing)
  const params = await props.params

  // Validate and determine locale, fallback to default if not valid
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale

  // Extract route parameters
  const { chain, contract, tokenId } = params

  // Load localized translations for this locale
  // TODO: Consider fetching translations in parallel with route param extraction.
  const t = await loadTranslations(locale)
  
  // Render main NFT information panel
  return (
    <StoreWrapper locale={locale}>
      <div className="container mx-auto px-0 py-0">
        {/* Page Heading */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t.modules.nft.item.title} #{tokenId}
          </h1>
          <p className="text-muted-foreground">
            {t.modules.nft.item.subtitle}
          </p>
        </div>

        {/* NFT Chain/Contract/TokenID Detail Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Chain Information */}
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-1">{t.modules.nft.item.chain}</p>
            <p className="font-mono text-sm break-all">{chain}</p>
          </div>
          {/* Contract Information, show shortened address */}
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-1">{t.modules.nft.item.contract}</p>
            <p className="font-mono text-sm break-all">
              {contract.slice(0, 10)}...{contract.slice(-8)}
            </p>
          </div>
          {/* Token ID */}
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-1">{t.modules.nft.item.tokenId}</p>
            <p className="font-mono text-sm">{tokenId}</p>
          </div>
        </div>

        {/* Placeholder for coming soon content */}
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground">
            {t.modules.nft.item.comingSoon}
          </p>
        </div>
      </div>
    </StoreWrapper>
  )
}

// TODO: Consider using React 19's use() hook in client components for handling translations async (if/when moving to client).
// TODO: Consider using React 19's useOptimistic/useActionState for more robust optimistic UI on NFT item details.
// TODO: Consider using React 19's useTransition for better performance and user feedback on NFT item details.
// TODO: Consider using React 19's useEffect for handling NFT item details data fetching.
// TODO: Consider using React 19's useCallback for handling NFT item details data fetching.
// TODO: Consider using React 19's useMemo for handling NFT item details data fetching.
// TODO: Consider using React 19's useRef for handling NFT item details data fetching.
// TODO: Consider using React 19's useState for handling NFT item details data fetching.