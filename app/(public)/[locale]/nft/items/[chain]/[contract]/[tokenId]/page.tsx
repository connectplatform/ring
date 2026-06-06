import type { Metadata } from 'next'
import type { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale, type Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { loadTranslations } from '@/i18n/load-translations'
import { setRequestLocale } from 'next-intl/server'
import StoreWrapper from '@/components/wrappers/store-wrapper'
import { buildLocalizedMetadata, RING_PLATFORM_SEO } from '@/lib/seo-metadata'

type ItemParams = { chain: string; contract: string; tokenId: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; chain: string; contract: string; tokenId: string }>
}): Promise<Metadata> {
  const { locale: localeParam, chain, contract, tokenId } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'nft.item',
    pathname: `/nft/items/${chain}/${contract}/${tokenId}`,
    variables: { chain, contract, tokenId },
    siteName: RING_PLATFORM_SEO.siteName,
    twitterSite: RING_PLATFORM_SEO.twitterSite,
  })
}

export default async function ItemPage(props: LocalePageProps<ItemParams>) {
  const params = await props.params
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale
  const { chain, contract, tokenId } = params
  const t = await loadTranslations(locale)
  
  return (
    <StoreWrapper locale={locale}>
      <div className="container mx-auto px-0 py-0">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t.modules.nft.item.title} #{tokenId}
          </h1>
          <p className="text-muted-foreground">
            {t.modules.nft.item.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-1">{t.modules.nft.item.chain}</p>
            <p className="font-mono text-sm break-all">{chain}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-1">{t.modules.nft.item.contract}</p>
            <p className="font-mono text-sm break-all">{contract.slice(0, 10)}...{contract.slice(-8)}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-1">{t.modules.nft.item.tokenId}</p>
            <p className="font-mono text-sm">{tokenId}</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground">
            {t.modules.nft.item.comingSoon}
          </p>
        </div>
      </div>
    </StoreWrapper>
  )
}


