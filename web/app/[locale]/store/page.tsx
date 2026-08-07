import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import StorePageClient from './store-page-client'
import StoreWrapper from '@/components/wrappers/store-wrapper'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'

// Generates localized metadata for the store page, including canonical URLs and dynamic variables
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  // Destructure the "locale" parameter from the incoming promise
  const { locale: localeParam } = await params

  // Determine if the locale is supported; fallback to default if not
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  // Set the request locale for SSR and client hydration
  setRequestLocale(locale)

  // Determine base URL (fall back to prod URL if env not set)
  const base = process.env.NEXT_PUBLIC_API_URL || 'https://ring-platform.org'

  // Build metadata, allowing for localized SEO and canonical URLs
  return buildLocalizedMetadata({
    locale,
    path: 'store',
    variables: { count: '20' }, // Can be used for dynamic metadata, e.g. "20 products"
    pathname: '/store',
    canonicalUrl: `${base}${ROUTES.STORE(locale)}`,
  })
}

// TODO: In Next 13.4+ with React 19/Next 16, you can use `generateStaticParams` or route segment configs 
// to statically type and validate route params on the server side, reducing need for fallback logic here.

export default async function StorePage({ params }: { params: Promise<{ locale: Locale }> }) {
  // Await the params to get the current locale
  const { locale } = await params

  // Validate locale against supported locales; fallback to default locale if invalid
  const validLocale = routing.locales.includes(locale as Locale) ? locale : routing.defaultLocale

  // TODO: Consider using the "useLocale" or segmentConfig features for locale extraction and validation in React 19/Next 16.

  // Render the wrapped store page client for the given (validated) locale
  return (
    <StoreWrapper key={validLocale} locale={validLocale}>
      <StorePageClient locale={validLocale} />
    </StoreWrapper>
  )
}
