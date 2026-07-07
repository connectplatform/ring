import type { Metadata } from 'next'
// Import connection utility (establishes DB or backend connection)
import { connection } from 'next/server'
// Import intl helpers for locale handling and translations
import { setRequestLocale, getTranslations } from 'next-intl/server'
// Custom locale routing config
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
// Function to fetch list of public pools (DAOs)
import { listPublicPools } from '@/features/public-pools/services/public-pool-service'
// Helper to get native token symbol
import { getNativeTokenSymbol } from '@/lib/ring-config-chain'
// Client-side component for displaying DAOs
import { DaoListClient } from './dao-list-client'

// TODO: Replace next-intl getTranslations with Next.js app directory's built-in getTranslations when Next 16 i18n is stable and supports locale-aware hooks
// TODO: Refactor setRequestLocale to use Next 16 built-in locale context if/when available
// TODO: When React 19 & Next 16 are stable, migrate to server actions, server components, or new use() hook for data fetching and async translation

// Generates page metadata using async translations and determined locale
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  await connection() // Ensure backend connection is ready, e.g., DB connection
  // Wait for resolved params (locale)
  const { locale: localeParam } = await params
  // Determine valid locale, fallback to defaultLocale if not found
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  // Fetch translations for the determined locale/namespace
  // TODO: Replace with Next.js app dir getTranslations API when stable
  const t = await getTranslations({ locale, namespace: 'modules.dao' })
  // Get blockchain native token symbol (e.g., ETH, BTC)
  const token = getNativeTokenSymbol()

  // Return translated metadata
  return {
    title: t('listingTitle'),
    description: t('listingDescription', { token }),
  }
}

// Page server component to render DAO listing
export default async function DaoListingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection() // Prepare backend/data access layer

  // Extract and validate the locale param, fallback to default if not supported
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  // Set global/request-scoped locale for the current request
  // TODO: Switch to Next 16 built-in locale context if available (use server actions/context)
  setRequestLocale(locale)

  // Fetch list of public DAOs/pools from backend
  // NOTE: Consider caching pools for performance, if pools are relatively static
  const pools = await listPublicPools()

  // Fetch translations for the current page/locale
  // TODO: Replace with built-in Next.js getTranslations once supported in app dir
  const t = await getTranslations({ locale, namespace: 'modules.dao' })
  // Get blockchain native token symbol used in copy
  const token = getNativeTokenSymbol()

  // Render the layout and pass props to client component
  return (
    <div className="container mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {/* Headline translation for DAO listing */}
          {t('listingTitle')}
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          {/* Description translation, interpolated with native token symbol */}
          {t('listingDescription', { token })}
        </p>
      </header>
      {/* Pass retrieved pools and locale to client DAO list component */}
      <DaoListClient pools={pools} locale={locale} />
    </div>
  )
}
