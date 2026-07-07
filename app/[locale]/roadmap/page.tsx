import type { Metadata } from 'next'
import { connection } from 'next/server'
import { setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { RoadmapPage } from '@/components/pages/roadmap-page'

// The generateMetadata async function is invoked by Next.js for dynamic metadata creation.
// It extracts the locale from async params, validates it, sets the request locale,
// and calls a helper to create locale-specific SEO metadata.
export async function generateMetadata({
  params,
}: {
  // The use of Promise<{ locale: string }> for params is sometimes unnecessary with Next 13+ routing conventions,
  // unless params is intentionally awaited. If not, this can be simplified.
  // TODO: Consider using direct object ({ locale: string }) if params is not genuinely a Promise in your route segment.
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  // Await for params to resolve actual object with locale
  const { locale: localeParam } = await params

  // Validate the incoming locale parameter and provide fallback
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  // Set the current request's locale context for later retrievals
  setRequestLocale(locale)

  // Build and return the SEO metadata for the given locale and path
  return buildLocalizedMetadata({
    locale,
    path: 'roadmap',
    pathname: '/roadmap',
  })
}

export default async function PublicRoadmapPage({
  params,
}: {
  // TODO: If params is not a Promise in Next.js 16/React 19 app route handlers,
  // change to just { locale: string } and remove unnecessary awaits.
  params: Promise<{ locale: string }>
}) {
  // Ensures any required server connection or setup for this page is done
  await connection()

  // Extract the locale parameter (needs await here since params is a Promise)
  const { locale: localeParam } = await params

  // Validate that the locale exists in your supported locales, otherwise fallback
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  // Set up the translation/locale context for everything under this request
  setRequestLocale(locale)

  // Render the main RoadmapPage in the selected locale context
  return <RoadmapPage />
}
