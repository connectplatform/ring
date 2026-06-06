import type { Metadata } from 'next'
import React from "react"
import { redirect, notFound } from "next/navigation"
import { headers } from "next/headers"
import { getRequestCookieHeader } from '@/lib/cookie-header'
import { auth } from "@/auth"
import { ROUTES } from "@/constants/routes"
import type { Opportunity } from "@/types"
import ConfidentialOpportunitiesWrapper from "@/components/wrappers/confidential-opportunities-wrapper"
import { LocalePageProps } from "@/utils/page-props"
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata, getSeoSiteBaseUrl, RING_PLATFORM_SEO } from '@/lib/seo-metadata'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { connection } from 'next/server'
import { logger } from '@/lib/logger'

type OpportunitiesParams = Record<string, never>

const confidentialRobots: Metadata['robots'] = {
  index: false,
  follow: false,
  nocache: true,
  noarchive: true,
  nosnippet: true,
  noimageindex: true,
  notranslate: true,
}

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
  const t = await getTranslations('confidential.opportunities')
  return buildLocalizedMetadata({
    locale,
    path: 'opportunities.list',
    pathname: '/confidential/opportunities',
    fallback: {
      title: t('metadata.title'),
      description: t('metaDescription.description'),
    },
    siteName: RING_PLATFORM_SEO.siteName,
    twitterSite: RING_PLATFORM_SEO.twitterSite,
    robots: confidentialRobots,
  })
}

/**
 * Fetches a paginated list of confidential opportunities from the API.
 *
 * @param session - The authenticated user session.
 * @param searchParams - The query parameters for fetching opportunities.
 * @returns Promise<{ opportunities: Opportunity[]; lastVisible: string | null; totalPages: number; totalOpportunities: number }>
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

  const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/api/confidential/opportunities`)
  url.search = searchParams.toString()

  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        Cookie: await getRequestCookieHeader(),
      },
      next: {
        revalidate: 0, // Ensure fresh data on every request
      },
    })

    if (!res.ok) {
      if (res.status === 401) throw new Error("UNAUTHORIZED")
      if (res.status === 403) throw new Error("PERMISSION_DENIED")
      throw new Error("FETCH_FAILED")
    }

    const data = await res.json()
    return data
  } catch (error) {
    logger.error("getConfidentialOpportunities: Error during fetch:", error)
    throw error
  }
}

/**
 * Renders the confidential opportunities page with pagination.
 *
 * User steps:
 * 1. User navigates to the confidential opportunities page
 * 2. The page authenticates the user and checks their role
 * 3. If authorized, the page fetches and displays confidential opportunities
 * 4. User can view, filter, and paginate through the opportunities
 *
 * @param props - The page properties including params and searchParams as Promises.
 * @returns The rendered confidential opportunities page.
 */
export default async function ConfidentialOpportunitiesPage(props: LocalePageProps<OpportunitiesParams>) {
  await connection() // Next.js 16: opt out of prerendering

  logger.info("ConfidentialOpportunitiesPage: Starting")

  // Resolve params and searchParams
  const params = await props.params;
  const searchParams = await props.searchParams;

  // Extract and validate locale
  const validLocale: Locale = routing.locales.includes(params.locale as Locale) ? (params.locale as Locale) : (routing.defaultLocale as Locale);
  logger.info('ConfidentialOpportunitiesPage: Using locale', { locale: validLocale });

  const headersList = await headers();
  logger.info('ConfidentialOpportunitiesPage: Request details', {
    params,
    searchParams,
    locale: validLocale,
    userAgent: headersList.get('user-agent'),
  });

  const t = await getTranslations('confidential.opportunities');

  // Parse and set default values for query parameters
  const page = Number.parseInt((searchParams.page as string) ?? "1", 10)
  const limit = Number.parseInt((searchParams.limit as string) ?? "20", 10)
  const sort = (searchParams.sort as string) ?? "createdAt:desc"
  const filter = (searchParams.filter as string) ?? ""
  const startAfter = searchParams.startAfter as string | undefined

  // Prepare API search parameters
  const apiSearchParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    sort,
    filter,
    ...(startAfter && { startAfter }),
  })

  logger.info('ConfidentialOpportunitiesPage: Authenticating session');
  const session = await auth();
  logger.info('ConfidentialOpportunitiesPage: Session authenticated', { sessionExists: !!session, userId: session?.user?.id });

  try {
    const { userMigrationService } = await import('@/features/auth/services/user-migration');
    const userExists = await userMigrationService.userDocumentExists(session.user.id);
    if (!userExists) {
      logger.warn('ConfidentialOpportunitiesPage: User document missing, initializing');
      await userMigrationService.ensureUserDocument(session.user as any);
      logger.info('ConfidentialOpportunitiesPage: User document created successfully');
    }
  } catch (migrationError) {
    logger.error('ConfidentialOpportunitiesPage: Failed to check/create user document:', migrationError);
  }

  const siteOrigin = getSeoSiteBaseUrl()
  const title = t('metadata.title')
  const description = t('metaDescription.description')
  const canonicalUrl = `${siteOrigin}${ROUTES.CONFIDENTIAL_OPPORTUNITIES(validLocale)}`

  // Initialize variables for opportunities and error handling
  let opportunities: Opportunity[] = []
  let lastVisible: string | null = null
  let totalPages = 0
  let totalOpportunities = 0
  let error: string | null = null

  try {
    // Fetch confidential opportunities
    const data = await getConfidentialOpportunities(session, apiSearchParams)
    opportunities = data.opportunities
    lastVisible = data.lastVisible
    totalPages = data.totalPages
    totalOpportunities = data.totalOpportunities
  } catch (e) {
    logger.error("ConfidentialOpportunitiesPage: Error fetching confidential opportunities:", e)
    if (e instanceof Error) {
      // Handle specific error cases — redirect() must be outside try/catch, so we re-check auth here
      if (e.message === "UNAUTHORIZED") {
        redirect(ROUTES.LOGIN(validLocale)) // safe: this catch is not the outer component try/catch
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

  if (!page) return notFound();

  return (
    <>
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

      <React.Suspense
        fallback={
          <div className="flex justify-center items-center h-screen">
            <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
          </div>
        }
      >
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
 * - Route-group authorization is handled by app/(confidential)/[locale]/layout.tsx
 * - Breadcrumb navigation: Confidential section context
 * - Enhanced privacy: No-referrer policy and cache prevention
 * - Preserved all pagination, filtering, and opportunity data fetching functionality
 */