import type { Metadata } from 'next'
import type { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale, type Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { loadTranslations } from '@/i18n/load-translations'
import { setRequestLocale } from 'next-intl/server'
import StoreWrapper from '@/components/wrappers/store-wrapper'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'

type CollectionsParams = {}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'nft.collections',
    pathname: '/nft/collections',
  })
}

export default async function CollectionsPage(props: LocalePageProps<CollectionsParams>) {
  const params = await props.params
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale
  const t = await loadTranslations(locale)
  
  return (
    <StoreWrapper locale={locale}>
      <div className="container mx-auto px-0 py-0">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t.modules.nft.collections.title}
          </h1>
          <p className="text-muted-foreground">
            {t.modules.nft.collections.subtitle}
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground">
            {t.modules.nft.collections.comingSoon}
          </p>
        </div>
      </div>
    </StoreWrapper>
  )
}


