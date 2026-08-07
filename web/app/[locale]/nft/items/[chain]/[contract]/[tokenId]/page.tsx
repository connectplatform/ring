import { redirect } from 'next/navigation'
import type { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'

type ItemParams = { chain: string; contract: string; tokenId: string }

export default async function ItemPage(props: LocalePageProps<ItemParams>) {
  const params = await props.params
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale
  const q = [params.chain, params.contract, params.tokenId].filter(Boolean).join(' ')

  redirect(`${ROUTES.NFT_MARKET(locale)}?q=${encodeURIComponent(q)}`)
}
