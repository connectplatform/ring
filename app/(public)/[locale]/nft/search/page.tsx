import type { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale, loadTranslations } from '@/i18n-config'
import StoreWrapper from '@/components/wrappers/store-wrapper'

type SearchParams = {}

// Allow caching for NFT search with moderate revalidation for marketplace data
export const dynamic = "auto"
export const revalidate = 180 // 3 minutes for NFT marketplace data

export default async function SearchPage(props: LocalePageProps<SearchParams>) {
  const params = await props.params
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale
  const t = await loadTranslations(locale)
  
  return (
    <StoreWrapper locale={locale}>
      <div className="container mx-auto px-0 py-0">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t.modules.nft.search.title}
          </h1>
          <p className="text-muted-foreground">
            {t.modules.nft.search.subtitle}
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground">
            {t.modules.nft.search.comingSoon}
          </p>
        </div>
      </div>
    </StoreWrapper>
  )
}


