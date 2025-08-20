import type { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale } from '@/i18n-config'

type CollectionParams = { slug: string }

export const dynamic = 'force-dynamic'

export default async function CollectionPage(props: LocalePageProps<CollectionParams>) {
  const params = await props.params
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale
  const { slug } = params
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold">Collection: {slug}</h1>
      <p className="text-muted-foreground">Coming soon</p>
    </div>
  )
}


