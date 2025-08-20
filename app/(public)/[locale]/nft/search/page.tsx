import type { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale } from '@/i18n-config'

type SearchParams = {}

export const dynamic = 'force-dynamic'

export default async function SearchPage(props: LocalePageProps<SearchParams>) {
  const params = await props.params
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold">NFT Search</h1>
      <p className="text-muted-foreground">Coming soon</p>
    </div>
  )
}


