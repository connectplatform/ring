import type { Metadata } from 'next'
import type { Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import MyOrdersClient from './my-orders-client'

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
    path: 'store.orders.list',
    pathname: '/store/orders',
    variables: { count: '0' },
    robots: { index: false, follow: false },
  })
}

export default function MyOrdersPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  return <MyOrdersClient params={params} />
}
