import type { Metadata } from 'next'
// Importing the TermsOfService React component
import TermsOfService from '@/features/terms/components/terms-of-service'
// Types for handling locale props
import { LocalePageProps } from '@/utils/page-props'
import type { Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
// Utility to generate localized SEO metadata
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
// Sets the current request's locale on the server
import { setRequestLocale } from 'next-intl/server'
// Connection is likely used for DB or app context on the server
import { connection } from 'next/server'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'

// There are no parameters expected for this route
type TermsParams = Record<string, never>

/**
 * Generates metadata for the page based on the resolved locale.
 * Next.js will invoke this method to produce page <head> metadata.
 * 
 * @param params Promise that resolves to the dynamic params; expects { locale }
 * @returns A Next.js Metadata object for SEO and other meta tags
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  // Waits for the params to resolve, then destructures locale
  const { locale: localeParam } = await params

  // If the locale is supported, use it. Otherwise, fallback to routing.defaultLocale
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  // Set the resolved locale for this request, affecting all localized hooks
  setRequestLocale(locale)

  // Return the constructed metadata (SEO, title, etc) for "terms" path
  return buildLocalizedMetadata({
    locale,
    path: 'terms',
    pathname: '/terms',
  })
  // TODO: With React 19 and Next 16, consider using the new Page Metadata API (static or dynamic) if available,
  // instead of async generateMetadata for improved type-safety and clarity.
}

/**
 * Renders the Terms of Service page. This is the page's default export as a server component.
 * 
 * @param props Props include params, which must be awaited (likely for route params hydration)
 * @returns The rendered TermsOfService component
 */
export default async function TermsPage(props: LocalePageProps<TermsParams>) {
  // Ensure all necessary backend/context connections are available for this request
  await connection()
  // Await any params (should be empty per TermsParams, likely has side effects or sets up context)
  await props.params
  // TODO: Consider removing the unnecessary 'await props.params' for clarity if there are no params.
  // TODO: If using React 19/Next 16 server components, check if these await statements are still required,
  // and refactor to take advantage of the improved server component streaming model and co-location.
  return (
    <RingRightRailLayout showRightRail={false} flushCenterPane contentClassName="pb-24 lg:pb-8">
      <DavinciCenterPane>
        <TermsOfService />
      </DavinciCenterPane>
    </RingRightRailLayout>
  )
}
