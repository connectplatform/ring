import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import CartWrapper from '@/components/wrappers/cart-wrapper'
import CartClient from './cartClient'
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
  return buildLocalizedMetadata({
    locale,
    path: 'store.cart',
    pathname: '/store/cart',
  })
}

export default async function CartPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const validLocale = routing.locales.includes(locale as Locale) ? locale : routing.defaultLocale

  return (
    <CartWrapper locale={validLocale}>
      <CartClient key={locale} locale={locale} />
    </CartWrapper>
  )
}
