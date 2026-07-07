import type { Metadata } from 'next'
import type { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale, type Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { loadTranslations } from '@/i18n/load-translations'
import { setRequestLocale } from 'next-intl/server'
import StoreWrapper from '@/components/wrappers/store-wrapper'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'

type SearchParams = {}

// Async function to generate metadata for this page
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  // Await params as they may come as a promise in Next.js server components
  const { locale: localeParam } = await params

  // Determine locale from supported locales, otherwise fallback to default
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  // Set the request's locale for proper translations and formatting
  setRequestLocale(locale)

  // Build localized metadata for SEO using locale and fixed path data
  return buildLocalizedMetadata({
    locale,
    path: 'nft.search',
    pathname: '/nft/search',
  })

  // TODO: With Next 16, can leverage dynamic metadata directly via the new metadata export
}

// Async server component to render the NFT Search page
export default async function SearchPage(props: LocalePageProps<SearchParams>) {
  // Await params in case they are promises (depending on how props are provided by Next.js)
  const params = await props.params

  // Validate and normalize locale; fallback to default if invalid
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale

  // Load translations for the resolved locale
  const t = await loadTranslations(locale)
  
  // Render page layout and UI elements, passing locale down to StoreWrapper
  return (
    <StoreWrapper locale={locale}>
      <div className="container mx-auto px-0 py-0">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {/* Localized page title */}
            {t.modules.nft.search.title}
          </h1>
          <p className="text-muted-foreground">
            {/* Localized subtitle/description */}
            {t.modules.nft.search.subtitle}
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground">
            {/* Localized "coming soon" message */}
            {t.modules.nft.search.comingSoon}
          </p>
        </div>
      </div>
    </StoreWrapper>
  )

  // TODO: In React 19 (Next 16), consider using the new use() hook for async data (e.g. use(loadTranslations(locale)))
  // TODO: Consider using partial pre-rendering or Server Actions for further optimizations
}
