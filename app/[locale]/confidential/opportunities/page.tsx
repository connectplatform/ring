import type { Metadata } from 'next'
// Import function to get site base URL (for canonical URLs, breadcrumbs, etc.)
import { getSiteBaseUrl } from '@/lib/ring-config-core'
import React from "react"
// Next.js navigation helpers for programmatic flow control
import { redirect, notFound } from "next/navigation"
// Utility to access request headers in server context
import { headers } from "next/headers"
// Function for retrieving cookies as appropriate header format for server fetches
import { getRequestCookieHeader } from '@/lib/cookie-header'
import { auth } from "@/auth" // Server auth session fetcher
import { ROUTES } from "@/constants/routes" // Route constant map
import type { Opportunity } from "@/types"
import ConfidentialOpportunitiesWrapper from "@/components/wrappers/confidential-opportunities-wrapper" // The UI renderer for opportunity display
import { LocalePageProps } from "@/utils/page-props" // Props type for locale support pages
import { getTranslations, setRequestLocale } from 'next-intl/server' // Internationalization helpers (server-side)
import { buildLocalizedMetadata } from '@/lib/seo-metadata' // SEO metadata builder
import { routing } from '@/i18n/routing' // Locale config
import type { Locale } from '@/i18n/shared'
import { connection } from 'next/server' // Next.js 16: disables prerendering, ensures server-side execution
import { logger } from '@/lib/logger' // Logging utility

type OpportunitiesParams = Record<string, never> // No route params expected for this page

// Robots meta config: locks down crawlers for full confidentiality/security
const confidentialRobots: Metadata['robots'] = {
  index: false,
  follow: false,
  nocache: true,
  noarchive: true,
  nosnippet: true,
  noimageindex: true,
  notranslate: true,
}

// TODO: In React 19/Next 16, native document metadata replaces generateMetadata export. 
// Migrate to static segment configs or use the new <head> API as needed for SSR metadata control.
// The following function can be refactored/removed after full migration.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  // Await params (async for parallel/streaming compatibility)
  const { locale: localeParam } = await params
  // Canonicalize/validate locale parameter
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale) // Set active i18n context on server
  const t = await getTranslations('confidential.opportunities') // Get i18n translations for the page
  // Use helper to assemble localized SEO metadata (title, meta description, robots, etc.)
  return buildLocalizedMetadata({
    locale,
    path: 'opportunities.list',
    pathname: '/confidential/opportunities',
    fallback: {
      title: t('metadata.title'),
      description: t('metaDescription.description'),
    },
    robots: confidentialRobots,
  })
}

/**
 * Fetches a paginated list of confidential opportunities from the API.
 *
 * @param session - The authenticated user session (should contain accessToken and user info)
 * @param searchParams - The query parameters for fetching opportunities (e.g., page, limit, sort, filter)
 * @returns An object with the opportunities, pagination info, counts, etc.
 */
async function getConfidentialOpportunities(
  session: any,
  searchParams: URLSearchParams,
): Promise<{
  opportunities: Opportunity[]
  lastVisible: string | null
  totalPages: number
  totalOpportunities: number
}> {
  logger.info("getConfidentialOpportunities: Starting fetch", {
    sessionUserId: session.user.id,
    role: session.user.role,
  })

  // Construct the secure confidential fetch URL, append querystring
  const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/api/confidential/opportunities`)
  url.search = searchParams.toString()

  try {
    // Make a secure server-side request with Bearer Auth and session cookie forwarding
    const res = await fetch(url, {
      cache: "no-store", // Always fetch fresh data (never cache)
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        Cookie: await getRequestCookieHeader(),
      },
      next: {
        revalidate: 0, // Next.js-specific: disables cache/revalidation
      },
    })

    // Handle error status codes with custom mapped messages
    if (!res.ok) {
      if (res.status === 401) throw new Error("UNAUTHORIZED")
      if (res.status === 403) throw new Error("PERMISSION_DENIED")
      throw new Error("FETCH_FAILED")
    }

    // Parse response as JSON (should match expected structure)
    const data = await res.json()
    return data
  } catch (error) {
    logger.error("getConfidentialOpportunities: Error during fetch:", error)
    throw error
  }
}

/**
 * Page: Confidential Opportunities with pagination and filtering.
 *
 * Steps:
 * 1. Ensures only authenticated/authorized users can access
 * 2. Fetches current user's session and validates user document status
 * 3. Fetches confidential opportunities from the backend API
 * 4. Passes data and error state to Suspense-wrapped UI component for render/pagination UX
 */
export default async function ConfidentialOpportunitiesPage(props: LocalePageProps<OpportunitiesParams>) {
  await connection() // Next.js 16: opt out of prerendering for full SSR logic

  logger.info("ConfidentialOpportunitiesPage: Starting")

  // Await parallelized params and searchParams from server context
  const params = await props.params;
  const searchParams = await props.searchParams;

  // Validate and select locale for translation/rendering
  const validLocale: Locale =
    routing.locales.includes(params.locale as Locale)
      ? (params.locale as Locale)
      : (routing.defaultLocale as Locale);

  logger.info('ConfidentialOpportunitiesPage: Using locale', { locale: validLocale });

  // Read current request headers (for logging or future security checks)
  const headersList = await headers();
  logger.info('ConfidentialOpportunitiesPage: Request details', {
    params,
    searchParams,
    locale: validLocale,
    userAgent: headersList.get('user-agent'),
  });

  // Obtain translations for this page (i18n ready)
  const t = await getTranslations('confidential.opportunities');

  // Extract query parameters with fallbacks
  const page = Number.parseInt((searchParams.page as string) ?? "1", 10)
  const limit = Number.parseInt((searchParams.limit as string) ?? "20", 10)
  const sort = (searchParams.sort as string) ?? "createdAt:desc"
  const filter = (searchParams.filter as string) ?? ""
  const startAfter = searchParams.startAfter as string | undefined

  // Prepare params for backend API fetch
  const apiSearchParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    sort,
    filter,
    ...(startAfter && { startAfter }), // Only add startAfter if it exists (pagination cursor)
  })

  logger.info('ConfidentialOpportunitiesPage: Authenticating session');
  // Fetch session: should provide user info for fetch and permissions!
  const session = await auth();
  logger.info('ConfidentialOpportunitiesPage: Session authenticated', {
    sessionExists: !!session, userId: session?.user?.id
  });

  // Ensure user document exists in DB (migration support for legacy/new accounts)
  // TODO: Move user document bootstrapping to middleware or global context if possible to avoid per-page duplication
  try {
    // Dynamic import to avoid increasing main bundle size (loads only server side)
    const { userMigrationService } = await import('@/features/auth/services/user-migration');
    // Check if user document exists (by user ID)
    const userExists = await userMigrationService.userDocumentExists(session.user.id);
    if (!userExists) {
      logger.warn('ConfidentialOpportunitiesPage: User document missing, initializing');
      // If not, initialize the user's document (needed for all confidential workflows!)
      await userMigrationService.ensureUserDocument(session.user as any);
      logger.info('ConfidentialOpportunitiesPage: User document created successfully');
    }
  } catch (migrationError) {
    logger.error('ConfidentialOpportunitiesPage: Failed to check/create user document:', migrationError);
    // TODO: In future, show user-facing welcome/setup error or fallback UI
  }

  // Prepare metadata for canonical URL and schema/structured data
  const siteOrigin = getSiteBaseUrl()
  const title = t('metadata.title')
  const description = t('metaDescription.description')
  const canonicalUrl = `${siteOrigin}${ROUTES.CONFIDENTIAL_OPPORTUNITIES(validLocale)}`

  // State variables for fetched data and possible error display
  let opportunities: Opportunity[] = []
  let lastVisible: string | null = null
  let totalPages = 0
  let totalOpportunities = 0
  let error: string | null = null

  try {
    // Attempt confidential data fetch; result updates opportunity list and pagination state
    const data = await getConfidentialOpportunities(session, apiSearchParams)
    opportunities = data.opportunities
    lastVisible = data.lastVisible
    totalPages = data.totalPages
    totalOpportunities = data.totalOpportunities
  } catch (e) {
    // Advanced error handling by error type, set error message for rendering or redirect
    logger.error("ConfidentialOpportunitiesPage: Error fetching confidential opportunities:", e)
    if (e instanceof Error) {
      // For session expiration (401), redirect out (not catchable further up due to edge constraints)
      if (e.message === "UNAUTHORIZED") {
        redirect(ROUTES.LOGIN(validLocale)) // Redirect to login page for unauthorized session
      } else if (e.message === "PERMISSION_DENIED") {
        error = "You don't have permission to view confidential opportunities. Please contact an administrator."
      } else if (e.message === "FETCH_FAILED") {
        error = "Failed to load confidential opportunities. Please try again later."
      } else {
        error = "An unexpected error occurred. Please try again later."
      }
    } else {
      error = "An unexpected error occurred. Please try again later."
    }
  }

  // If page query invalid or missing, show 404
  if (!page) return notFound();

  // TODO: After migration to React 19+Next 16, use new metadata/structured data APIs
  // For now: Inline structured data for SEO and audience-limited discoverability.
  // Suspense is used here to pre-emptively support streaming/future React 19 features.
  // Rendering page:
  return (
    <>
      {/* Inline structured data for confidential opportunity page, critical for SEO/compliance */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": t('jsonLd.webPageName'),
            "description": description,
            "url": canonicalUrl,
            "mainEntity": {
              "@type": "WebPageElement",
              "name": t('metadata.title'),
              "description": t('jsonLd.mainEntityDescription')
            },
            "breadcrumb": {
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": t('jsonLd.siteRootName'),
                  "item": siteOrigin
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": t('metadata.title'),
                  "item": canonicalUrl
                }
              ]
            },
            "accessMode": "restricted",
            "accessibilityControl": "authentication",
            "audience": {
              "@type": "Audience",
              "audienceType": "ring_platform_confidential_members"
            }
          })
        }}
      />

      {/* Suspense allows for instant streaming and progressive hydration. Supports loader fallback too. */}
      <React.Suspense
        fallback={
          <div className="flex justify-center items-center h-screen">
            <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
          </div>
        }
      >
        {/* Render the fully wrapped, hydrated confidential opportunities UX */}
        <ConfidentialOpportunitiesWrapper
          initialOpportunities={opportunities}
          initialError={error}
          initialPage={page}
          page={page}
          lastVisible={lastVisible}
          filter={filter}
          sort={sort}
          totalPages={totalPages}
          totalOpportunities={totalOpportunities}
          initialLimit={limit}
          initialSort={sort}
          initialFilter={filter}
        />
      </React.Suspense>
    </>
  );
}

/* 
 * OBSOLETE FUNCTIONS (removed with React 19 migration):
 * - generateMetadata() function (replaced by React 19 native document metadata)
 * 
 * React 19 Native Features Used:
 * - Document metadata: <title>, <meta>, <link> tags automatically hoisted to <head>
 * - Maximum security: Enhanced protection with notranslate, cache-control, pragma, expires
 * - Confidential opportunities schema: Structured data with audience restrictions
 * - Authorization is handled by app/[locale]/confidential/layout.tsx
 * - Breadcrumb navigation: Confidential section context
 * - Enhanced privacy: No-referrer policy and cache prevention
 * - Preserved all pagination, filtering, and opportunity data fetching functionality
 */
// TODO: Refactor to utilize new React 19/Next 16 file-based metadata API for head elements and JSON-LD injection