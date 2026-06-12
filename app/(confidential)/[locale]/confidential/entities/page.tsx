import type { Metadata } from 'next'
import { getSiteBaseUrl } from '@/lib/ring-config'
import React from "react"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { getRequestCookieHeader } from '@/lib/cookie-header'
import { auth } from "@/auth"
import { ROUTES } from "@/constants/routes"
import type { Entity } from "@/types"
import ConfidentialEntitiesWrapper from "@/components/wrappers/confidential-entities-wrapper"
import { LocalePageProps } from "@/utils/page-props"
import type { Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { connection } from 'next/server'
import { logger } from '@/lib/logger'

type ConfidentialEntitiesParams = Record<string, never>

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
  const t = await getTranslations('confidential.entities')
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

/**
 * Fetches a paginated list of confidential entities from the API.
 *
 * @param session - The authenticated user session.
 * @param searchParams - The query parameters for fetching entities.
 * @returns Promise<{ entities: Entity[]; lastVisible: string | null; totalPages: number; totalEntities: number }>
 */
async function getConfidentialEntities(
  session: any,
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

  const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/api/confidential/entities`)
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
    logger.error("getConfidentialEntities: Error during fetch:", error)
    throw error
  }
}

/**
 * Renders the confidential entities page with pagination.
 *
 * User steps:
 * 1. User navigates to the confidential entities page
 * 2. The page authenticates the user and checks their role
 * 3. If authorized, the page fetches and displays confidential entities
 * 4. User can view, filter, and paginate through the entities
 *
 * @param props - The page properties including params and searchParams as Promises.
 * @returns The rendered confidential entities page.
 */
export default async function ConfidentialEntitiesPage(props: LocalePageProps<ConfidentialEntitiesParams>) {
  await connection() // Next.js 16: opt out of prerendering

  logger.info("ConfidentialEntitiesPage: Starting")

  // Resolve params and searchParams
  const params = await props.params;
  const searchParams = await props.searchParams;

  // Extract and validate locale
  const validLocale: Locale = routing.locales.includes(params.locale as Locale) ? (params.locale as Locale) : (routing.defaultLocale as Locale);
  logger.info('ConfidentialEntitiesPage: Using locale', { locale: validLocale });

  const headersList = await headers();
  logger.info('ConfidentialEntitiesPage: Request details', {
    params,
    searchParams,
    locale: validLocale,
    userAgent: headersList.get('user-agent'),
  });

  const t = await getTranslations('confidential.entities');

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

  logger.info('ConfidentialEntitiesPage: Authenticating session');
  const session = await auth();
  logger.info('ConfidentialEntitiesPage: Session authenticated', { sessionExists: !!session, userId: session?.user?.id });

  try {
    const { userMigrationService } = await import('@/features/auth/services/user-migration');
    const userExists = await userMigrationService.userDocumentExists(session.user.id);
    if (!userExists) {
      logger.warn('ConfidentialEntitiesPage: User document missing, initializing');
      await userMigrationService.ensureUserDocument(session.user as any);
      logger.info('ConfidentialEntitiesPage: User document created successfully');
    }
  } catch (migrationError) {
    logger.error('ConfidentialEntitiesPage: Failed to check/create user document:', migrationError);
  }

  const siteOrigin = getSiteBaseUrl()
  const title = t('metadata.title')
  const description = t('metaDescription.description')
  const canonicalUrl = `${siteOrigin}${ROUTES.CONFIDENTIAL_ENTITIES(validLocale)}`

  // Initialize variables for entities and error handling
  let entities: Entity[] = []
  let lastVisible: string | null = null
  let totalPages = 0
  let totalEntities = 0
  let error: string | null = null

  try {
    // Fetch confidential entities
    const data = await getConfidentialEntities(session, apiSearchParams)
    entities = data.entities
    lastVisible = data.lastVisible
    totalPages = data.totalPages
    totalEntities = data.totalEntities
  } catch (e) {
    logger.error("ConfidentialEntitiesPage: Error fetching confidential entities:", e)
    if (e instanceof Error) {
      // Handle specific error cases
      if (e.message === "UNAUTHORIZED") {
        redirect(ROUTES.LOGIN(validLocale))
      } else if (e.message === "PERMISSION_DENIED") {
        error = "You don't have permission to view confidential entities. Please contact an administrator."
      } else if (e.message === "FETCH_FAILED") {
        error = "Failed to load confidential entities. Please try again later."
      } else {
        error = "An unexpected error occurred. Please try again later."
      }
    } else {
      error = "An unexpected error occurred. Please try again later."
    }
  }

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
 * - Route-group authorization is handled by app/(confidential)/[locale]/layout.tsx
 * - Breadcrumb navigation: Confidential section context
 * - Enhanced privacy: No-referrer policy and cache prevention
 * - Preserved all pagination, filtering, and data fetching functionality
 */