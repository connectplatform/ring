import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import CartWrapper from '@/components/wrappers/cart-wrapper'
import CartClient from './cartClient'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'

// This function generates the metadata for the Cart page, using the async params prop (expected from Next.js server components).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  // Await the params object, destructure the locale from it
  const { locale: localeParam } = await params
  // Validate that the locale from params is among the supported locales. If not, fallback to the default locale.
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  // Set the request's active locale context
  setRequestLocale(locale)
  // Delegate to a site utility to build the localized SEO metadata for this page route.
  return buildLocalizedMetadata({
    locale,
    path: 'store.cart',
    pathname: '/store/cart',
  })
}

// This is the main Cart Page, rendered as a server component.
// TODO: Next.js 13+ now allows simpler params type: use `{ params: { locale: Locale } }` directly as prop, removing the need for a Promise and await.
export default async function CartPage({ params }: { params: Promise<{ locale: Locale }> }) {
  // Await the params and extract the locale
  const { locale } = await params
  // Validate that the locale is supported; default if not.
  const validLocale = routing.locales.includes(locale as Locale) ? locale : routing.defaultLocale

  // Render the cart page using a wrapper and a client component.
  // CartWrapper presumably provides locale context or styling.
  // CartClient is a client component that receives the user's locale as prop.
  // TODO: With React 19/Next 16, consider using the new useParams hook (in client components) or directly handling route params in the component props if possible.
  return (
    <CartWrapper locale={validLocale}>
      {/* use locale as a key to ensure CartClient re-renders on locale change */}
      <CartClient key={locale} locale={locale} />
    </CartWrapper>
  )
}
