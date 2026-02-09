import type { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale, loadTranslations } from '@/i18n-config'
import StoreWrapper from '@/components/wrappers/store-wrapper'

type ItemParams = { chain: string, contract: string, tokenId: string }

// Allow caching for individual NFT items with moderate revalidation for marketplace data

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


