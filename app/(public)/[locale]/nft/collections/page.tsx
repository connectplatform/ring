import type { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale, loadTranslations } from '@/i18n-config'

type CollectionsParams = {}

export const dynamic = 'force-dynamic'

export default async function CollectionsPage(props: LocalePageProps<CollectionsParams>) {
  const params = await props.params
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale
  const translations = loadTranslations(locale)
  const title = 'NFT Collections'
  const description = 'Browse collections'
  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground">Coming soon</p>
      </div>
    </>
  )
}


