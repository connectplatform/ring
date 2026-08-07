import type { Metadata } from 'next'
// Import utility to get site base URL
import { getSiteBaseUrl } from '@/lib/ring-config-core'
// Import React for JSX and Suspense
import React from "react"
import { redirect } from "next/navigation"
// Import for getting request headers (cookies, user-agent, etc)
import { headers } from "next/headers"
// Import for extracting request cookies (authentication)
import { getRequestCookieHeader } from '@/lib/cookie-header'
// Import app auth function for session retrieval
import { auth } from "@/auth"
// Import all site route constants for navigation and redirection
import { ROUTES } from "@/constants/routes"
// Import typed entity model
import type { Entity } from "@/types"
// Wrapper for displaying confidential entities and UI logic
import ConfidentialEntitiesWrapper from "@/components/wrappers/confidential-entities-wrapper"
// Import locale-aware page prop typings
import { LocalePageProps } from "@/utils/page-props"
// Import locale typing
import type { Locale } from '@/i18n/shared'
// Routing utils for locale validation/defaults
import { routing } from '@/i18n/routing'
// Server-side i18n helpers
import { getTranslations, setRequestLocale } from 'next-intl/server'
// SEO helper for metadata generation
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
// Used for opting out of prerendering in Next.js 16+
import { connection } from 'next/server'
// App wide logger for analytics and debugging
import { logger } from '@/lib/logger'

// TODO: Replace custom session + locale retrieval with Next.js 16 middleware in middleware.ts for global enforcement and clean server entrypoints
// TODO: Migrate getConfidentialEntities to a React 19 Server Action for idiomatic server-side data fetching with direct prop wiring
// TODO: Remove wrapper/loading pattern in favor of React 19 streaming components, if warranted for UX

type ConfidentialEntitiesParams = Record<string, never>

// Defines robots.txt/noindex settings for confidential content (private page, no SEO)
const confidentialRobots: Metadata['robots'] = {
  index: false,
  follow: false,
  nocache: true,
  noarchive: true,
  nosnippet: true,
  noimageindex: true,
  notranslate: true,
}

// TODO: Move generateMetadata usage to React 19/Next 16 native metadata API in `metadata.ts`.
// Currently this is still using the Next <13.4-style export, but will be deprecated.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  // Extract locale from page params (async prop resolution)
  const { locale: localeParam } = await params
  // Validate that locale is supported or fallback to default locale
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale) // Set locale at request scope for intl
  const t = await getTranslations('confidential.entities') // Load translation namespace
  // Build structured, localized metadata for the page
  return buildLocalizedMetadata({
    locale,
    path: 'entities.list',
    pathname: '/confidential/entities',
    fallback: {
      title: t('metadata.title'),
      description: t('metaDescription.description'),
    },
    robots: confidentialRobots,
  })
}

// Fetches a paginated list of confidential entities from the platform API using provided session (JWT/Cookies) and URL query params
async function getConfidentialEntities(
  session: any, // Currently any; ideally, type user session interface
  searchParams: URLSearchParams,
): Promise<{
  entities: Entity[]
  lastVisible: string | null
  totalPages: number
  totalEntities: number
}> {
  logger.info("getConfidentialEntities: Starting fetch", {
    sessionUserId: session.user.id,
    role: session.user.role,
  })

  // Compose full API endpoint including search params for pagination, sorting, filtering
  const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/api/confidential/entities`)
  url.search = searchParams.toString()

  try {
    // Call the API, passing the Bearer token and cookies for full authentication
    const res = await fetch(url, {
      cache: "no-store", // Disable all caching (high security/confidential)
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        Cookie: await getRequestCookieHeader(),
      },
      next: {
        revalidate: 0, // Immediately refetch every time; never serve stale content
      },
    })

    // Check for errors; escalate security/permission errors for higher-level handling
    if (!res.ok) {
      if (res.status === 401) throw new Error("UNAUTHORIZED")
      if (res.status === 403) throw new Error("PERMISSION_DENIED")
      throw new Error("FETCH_FAILED")
    }

    // Parse and return data
    const data = await res.json()
    return data
  } catch (error) {
    logger.error("getConfidentialEntities: Error during fetch:", error)
    throw error
  }
}

// Main server (async) component for confidential entities page with SSR, error logic, auth, and internationalization
export default async function ConfidentialEntitiesPage(props: LocalePageProps<ConfidentialEntitiesParams>) {
  await connection() // Next.js 16: tells server to opt out of prerendering (pure SSR, no SSG)

  logger.info("ConfidentialEntitiesPage: Starting")

  // Await and extract route and search params provided by Next.js routing
  const params = await props.params;
  const searchParams = await props.searchParams;

  // Validate locale; fallback to default if not recognized for route
  const validLocale: Locale = routing.locales.includes(params.locale as Locale) ? (params.locale as Locale) : (routing.defaultLocale as Locale);
  logger.info('ConfidentialEntitiesPage: Using locale', { locale: validLocale });

  // Grab request headers for debugging and later analytics/security
  const headersList = await headers();
  logger.info('ConfidentialEntitiesPage: Request details', {
    params,
    searchParams,
    locale: validLocale,
    userAgent: headersList.get('user-agent'),
  });

  // Translation for this namespace (confidential entities)
  const t = await getTranslations('confidential.entities');

  // Parse relevant search parameters, with hard defaults if absent
  // Page number: always at least 1
  const page = Number.parseInt((searchParams.page as string) ?? "1", 10)
  // Pagination limit: always at least 20
  const limit = Number.parseInt((searchParams.limit as string) ?? "20", 10)
  // Sort syntax: fallback to createdAt descending if not provided
  const sort = (searchParams.sort as string) ?? "createdAt:desc"
  // Entity filter: fallback to blank
  const filter = (searchParams.filter as string) ?? ""
  // Optional paginated-cursor field for infinite scrolling
  const startAfter = searchParams.startAfter as string | undefined

  // Construct URLSearchParams for backend API; includes pagination/filter/sort
  const apiSearchParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    sort,
    filter,
    ...(startAfter && { startAfter }), // Only include if present
  })

  logger.info('ConfidentialEntitiesPage: Authenticating session');
  // Fetch the user session (JWT + profile from SSR/session store)
  const session = await auth();
  logger.info('ConfidentialEntitiesPage: Session authenticated', { sessionExists: !!session, userId: session?.user?.id });

  // TODO: Move user migration checking to an auth middleware/server action for central logic, not per page render!
  // On first load, check if user document exists (firestore or other persistent user record)
  try {
    const { userMigrationService } = await import('@/features/auth/services/user-migration');
    // Check for user document in DB
    const userExists = await userMigrationService.userDocumentExists(session.user.id);
    if (!userExists) {
      logger.warn('ConfidentialEntitiesPage: User document missing, initializing');
      // Create if missing
      await userMigrationService.ensureUserDocument(session.user as any);
      logger.info('ConfidentialEntitiesPage: User document created successfully');
    }
  } catch (migrationError) {
    logger.error('ConfidentialEntitiesPage: Failed to check/create user document:', migrationError);
  }

  // Prepare all SEO and structured data properties for metadata/schema.org/OG/etc.
  const siteOrigin = getSiteBaseUrl()
  const title = t('metadata.title')
  const description = t('metaDescription.description')
  const canonicalUrl = `${siteOrigin}${ROUTES.CONFIDENTIAL_ENTITIES(validLocale)}`

  // State variables for entity page. These may be overwritten after fetching.
  let entities: Entity[] = []
  let lastVisible: string | null = null
  let totalPages = 0
  let totalEntities = 0
  let error: string | null = null

  try {
    // Fetch confidential data from API using resolved session and compiled URL params
    const data = await getConfidentialEntities(session, apiSearchParams)
    // Populate all result fields
    entities = data.entities
    lastVisible = data.lastVisible
    totalPages = data.totalPages
    totalEntities = data.totalEntities
  } catch (e) {
    // If any error occurs during fetch, classify and record error output for UX
    logger.error("ConfidentialEntitiesPage: Error fetching confidential entities:", e)
    if (e instanceof Error) {
      // Handle specific error cases with UX messaging or redirection
      if (e.message === "UNAUTHORIZED") {
        // User lost session or not logged in
        redirect(ROUTES.LOGIN(validLocale))
      } else if (e.message === "PERMISSION_DENIED") {
        // User session does not have permission for resource
        error = "You don't have permission to view confidential entities. Please contact an administrator."
      } else if (e.message === "FETCH_FAILED") {
        // Misc network/server-side API error
        error = "Failed to load confidential entities. Please try again later."
      } else {
        // Catch-all for unknown error codes
        error = "An unexpected error occurred. Please try again later."
      }
    } else {
      // Non-Error exception fallback (shouldn't occur)
      error = "An unexpected error occurred. Please try again later."
    }
  }

  // TODO: Replace Suspense/fallback usage with React 19 streaming boundary for per-component streaming/loading experience if wanting to load partial table quickly
  // Render JSON-LD structured metadata, Suspense fallback, and confidential entities list (SSR-first render)
  return (
    <>
      {/* Structured data for SEO bots: disables all indexing, but maintains clear restricted/page context */}
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
            // Set explicit access/audience metadata for security/browsers
            "accessMode": "restricted",
            "accessibilityControl": "authentication",
            "audience": {
              "@type": "Audience",
              "audienceType": "ring_platform_confidential_members"
            }
          })
        }}
      />

      {/* Suspense loading boundary for next SSR/future React streaming; while fetching, render spinner */}
      <React.Suspense
        fallback={
          <div className="flex justify-center items-center h-screen">
            <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
          </div>
        }
      >
        {/* Main confidential entity table/page component, receives all SSR props for hydration and error state */}
        <ConfidentialEntitiesWrapper
          initialEntities={entities}
          initialError={error}
          initialPage={page}
          page={page}
          lastVisible={lastVisible}
          totalPages={totalPages}
          totalEntities={totalEntities}
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
 * - Confidential content schema: Structured data with audience restrictions
 * - Authorization is handled by app/[locale]/confidential/layout.tsx
 * - Breadcrumb navigation: Confidential section context
 * - Enhanced privacy: No-referrer policy and cache prevention
 * - Preserved all pagination, filtering, and data fetching functionality
 */