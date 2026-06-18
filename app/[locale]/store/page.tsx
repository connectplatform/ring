import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import StorePageClient from './store-page-client'
import StoreWrapper from '@/components/wrappers/store-wrapper'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'

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
  const base = process.env.NEXT_PUBLIC_API_URL || 'https://ring.platform'
  return buildLocalizedMetadata({
    locale,
    path: 'store',
    variables: { count: '20' },
    pathname: '/store',
    canonicalUrl: `${base}${ROUTES.STORE(locale)}`,
  })
}

export default async function StorePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const validLocale = routing.locales.includes(locale as Locale) ? locale : routing.defaultLocale

  return (
    <StoreWrapper key={validLocale} locale={validLocale}>
      <StorePageClient locale={validLocale} />
    </StoreWrapper>
  )
}
