import type { Metadata } from 'next'
import type { Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import MyOrdersClient from './my-orders-client'

// This async function generates metadata for the orders page based on the current locale.
// It expects a `params` prop containing (a Promise of) an object with a `locale` key.
// The function extracts the locale parameter, validates it against supported locales,
// and falls back to the default if it's not valid. It then sets the request locale 
// for the server-side (i18n) context, and returns the SEO metadata.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  // Await and destructure the locale param from the `params` Promise.
  const { locale: localeParam } = await params

  // Check if localeParam is one of the supported locales.
  // If not, use the default locale.
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  // Set the active locale context for this server request (for next-intl).
  setRequestLocale(locale)

  // Build and return localized metadata for SEO purposes.
  // The path and pathname stay fixed. Robots are set to not index or follow.
  return buildLocalizedMetadata({
    locale,
    path: 'store.orders.list',
    pathname: '/store/orders',
    variables: { count: '0' },
    robots: { index: false, follow: false },
  })
}

// The main page component for the "My Orders" store route.
// It expects a Promise of params, containing a `locale`. It passes this to
// the client component, which presumably renders the actual order view.
// TODO: Consider switching to Route Segment Config in Next.js 13+ for locale param extraction.
// TODO: Evaluate if params can now be passed as plain objects instead of as a Promise (React 19 / Next 16 change).
export default function MyOrdersPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  // Simply delegate to the client component and pass down params.
  return <MyOrdersClient params={params} />
}
