import { notFound } from 'next/navigation'
import type { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale, loadTranslations } from '@/i18n-config'

type ItemParams = { chain: string, contract: string, tokenId: string }

export const dynamic = 'force-dynamic'

export default async function ItemPage(props: LocalePageProps<ItemParams>) {
  const params = await props.params
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale
  const { chain, contract, tokenId } = params
  const translations = loadTranslations(locale)
  const title = `NFT ${tokenId}`
  const description = 'NFT details and listings'
  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <div className="text-muted-foreground">Chain: {chain}, Contract: {contract}</div>
        <p className="mt-4">Coming soon</p>
      </div>
    </>
  )
}


