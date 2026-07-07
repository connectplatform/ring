// Import type for page metadata from Next.js, which describes how HTTP metadata is built for SSR.
import type { Metadata } from 'next'

// Import ring platform configuration functions and utilities.
import { getRingSeoBranding, getSiteBaseUrl } from '@/lib/ring-config-core'
// Import server translation API for locale switching (Next Intl package).
import { setRequestLocale } from 'next-intl/server'
// Import routing config (locales, defaultLocale list).
import { routing } from '@/i18n/routing'
// Import strongly-typed locale string.
import type { Locale } from '@/i18n/shared'
// Import SEO-metadata helper to build metadata from params and config.
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
// Import type for Next.js Page Props for param typing.
import { LocalePageProps } from '@/utils/page-props'
// Import the Home page server wrapper component—see note for potential optimization.
import HomeWrapper from '@/components/wrappers/home-wrapper'
// Import constants to generate localized, semantic route URLs.
import { ROUTES } from '@/constants/routes'
// Import a re-usable JsonLd component for SEO (renders JSON-LD in <head> tag).
import { JsonLd } from '@/components/seo/json-ld'

// Home page receives no dynamic params at this layer.
// STUB: If future params/feature toggles appear on the home route, extend this type and update logic.
type HomePageParams = Record<string, never>

/**
 * Generate localized SEO metadata for the marketing home page.
 *
 * @param params - async params function containing the locale (matches [[locale]]/page convention)
 * @returns Localized SEO Metadata object—or falls back to default locale if invalid.
 *
 * Note: Uses SSR-only side-effects to set up translation state!
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  // Await incoming dynamic segment params and extract the locale (wrapped in a Promise by Next.js route conventions).
  const { locale: localeParam } = await params

  // Validate the provided locale against the app's list of allowed locales.
  // If invalid, fallback to routing.defaultLocale.
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  // Set the resolved locale into context for all downstream translation functions (required for SSR).
  setRequestLocale(locale)

  // Build and return SEO metadata (title, description, alternates, OpenGraph) using localized config and templates.
  return buildLocalizedMetadata({
    locale,
    path: 'home',
    variables: { platform: getRingSeoBranding().siteName },
    pathname: '/', // This is always the root for the localized home.
  })

  // TODO: Next.js 16+ now supports per-route/segment static `metadata.ts` files; this could be refactored to use
  //       the recommended `metadata` export *or* `generateMetadata()` with static generation for public pages.
  // TODO: Consider switching to static metadata file for this route if locale/SEO is not dynamic at runtime.
  //       See https://nextjs.org/docs/app/api-reference/functions/generate-metadata
}

/**
 * Marketing home page (/"root") route. No session-specific UI or server auth logic.
 * Note: All account/session-based islands are rendered via client components in navigation/sidebars.
 * 
 * Implements SSR locale and SEO setup.
 * 
 * @param params - Awaitable params prop (Next.js convention!)
 */
export default async function HomePage({ params }: LocalePageProps<HomePageParams>) {
  // Await actual params value (since this could be an async loader in server routes, per Next.js conventions).
  const resolvedParams = await params

  // Extract and validate the locale parameter.
  // Defensive: Always fallback to defaultLocale if the incoming value is invalid (prevents SSR bugs).
  const locale = routing.locales.includes(resolvedParams.locale as Locale)
    ? resolvedParams.locale
    : routing.defaultLocale

  // Set the locale contextually for SSR translations (required by next-intl/server).
  setRequestLocale(locale)

  // Generate the base siteURL (used in absolute asset/meta references and for JSON-LD).
  const baseUrl = getSiteBaseUrl()

  // Prepare JSON-LD structured data for the home page for improved SEO (Google/Knowledge Graph/AI search).
  // All URLs constructed are absolute and localized as required by schema.org guidelines.
  // TODO: Move JSON-LD schema definition to an isolated utility (`@/lib/seo/jsonld.ts`) if the logic grows.
  const websiteJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: getRingSeoBranding().siteName, // Localized/Branded site name for SEO
    description:
      'Clone and deploy a white-label Ring: Entities, Opportunities, multi-vendor Store, wallet, messaging, and AI matching. React 19, Next.js 16, Auth.js v5. Free OSS on GitHub; Ringdom for hosted ringization.',
    url: `${baseUrl}${ROUTES.HOME(locale as Locale)}`, // Primary localized site URL
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}${ROUTES.OPPORTUNITIES(locale as Locale)}?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
    publisher: {
      '@type': 'Organization',
      name: getRingSeoBranding().siteName,
      url: baseUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/logo.svg`,
      },
    },
    inLanguage: locale,
  }

  // TODO: With React 19 server components and Next.js 16 layouts,
  //       - Consider moving <JsonLd /> and <HomeWrapper /> into separate server or client components if either contains large/rarely-used sections (optimizes client JS tree-shaking & RSC hydration).
  //       - If <HomeWrapper /> does conditional imports, refactor to use React.lazy or dynamic() for partial hydration.
  //       - Explore replacing large object construction (`websiteJsonLd`) with a server utility or loader to keep server component lean.

  // Render SEO structured data + main home page UI.
  return (
    <>
      {/* Inject schema.org JSON-LD into <head> for search engines and AI */}
      <JsonLd id={`ring-home-website-jsonld-${locale}`} data={websiteJsonLd} />
      {/* Main marketing home shell component (renders public/marketing UI only) */}
      <HomeWrapper />
    </>
  )
}
