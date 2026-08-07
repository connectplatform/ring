import { redirect } from 'next/navigation'
import type { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'

type SearchParams = { q?: string; query?: string }

export default async function SearchPage(props: LocalePageProps<SearchParams>) {
  const params = await props.params
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale
  const searchParams = (await props.searchParams) as SearchParams | undefined
  const q = searchParams?.q || searchParams?.query || ''
  redirect(`${ROUTES.NFT_MARKET(locale)}${q ? `?q=${encodeURIComponent(q)}` : ''}`)
}
