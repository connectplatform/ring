import React from "react"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { getServerAuthSession } from "@/auth"
import { ROUTES } from "@/constants/routes"
import { UserRole } from "@/features/auth/types"
import type { Entity } from "@/types"
import ConfidentialEntitiesWrapper from "@/components/wrappers/confidential-entities-wrapper"
import { LocalePageProps } from "@/utils/page-props"
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates, type Locale } from '@/i18n-config'

// Force dynamic rendering for this page to ensure fresh data on every request
export const dynamic = "force-dynamic"

type ConfidentialEntitiesParams = {}

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
  console.log("getConfidentialEntities: Starting fetch", {
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
        Cookie: cookies().toString(),
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
    console.error("getConfidentialEntities: Error during fetch:", error)
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
  console.log("ConfidentialEntitiesPage: Starting")

  // Resolve params and searchParams
  const params = await props.params;
  const searchParams = await props.searchParams;

  // Extract and validate locale
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale;
  console.log('ConfidentialEntitiesPage: Using locale', locale);

  // Load translations for React 19 metadata
  const translations = loadTranslations(locale);

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

  // Authenticate user
  const session = await getServerAuthSession()

  // Check user authorization
  if (!session || (session.user?.role !== UserRole.CONFIDENTIAL && session.user?.role !== UserRole.ADMIN)) {
    console.log("ConfidentialEntitiesPage: Unauthorized access, redirecting")
    redirect(ROUTES.LOGIN(locale))
  }

  // React 19 metadata for confidential pages
  const title = (translations as any).metadata?.confidentialEntities || 'Confidential Entities | Ring App';
  const description = (translations as any).metaDescription?.confidentialEntities || 'Secure access to confidential entities in the Ring App ecosystem.';
  const canonicalUrl = `https://ring.ck.ua/${locale}/confidential/entities`;
  const alternates = generateHreflangAlternates('/confidential/entities');

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
    console.error("ConfidentialEntitiesPage: Error fetching confidential entities:", e)
    if (e instanceof Error) {
      // Handle specific error cases
      if (e.message === "UNAUTHORIZED") {
        redirect(ROUTES.LOGIN(locale))
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
      {/* React 19 Native Document Metadata - Confidential Page */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      
      {/* OpenGraph metadata */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content={locale === 'uk' ? 'uk_UA' : 'en_US'} />
      <meta property="og:alternate_locale" content={locale === 'uk' ? 'en_US' : 'uk_UA'} />
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      
      {/* Maximum security meta tags for confidential content */}
      <meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate" />
      <meta name="googlebot" content="noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate" />
      <meta name="referrer" content="no-referrer" />
      <meta name="cache-control" content="no-cache, no-store, must-revalidate" />
      <meta name="pragma" content="no-cache" />
      <meta name="expires" content="0" />
      
      {/* Hreflang alternates */}
      {Object.entries(alternates).map(([lang, url]) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={url as string} />
      ))}

      {/* Confidential content structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": "Confidential Entities - Ring Platform",
            "description": description,
            "url": canonicalUrl,
            "mainEntity": {
              "@type": "WebPageElement",
              "name": "Confidential Entity Directory",
              "description": "Secure directory of confidential entities with restricted access"
            },
            "breadcrumb": {
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": "Home",
                  "item": "https://ring.ck.ua"
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": "Confidential",
                  "item": `https://ring.ck.ua/${locale}/confidential`
                },
                {
                  "@type": "ListItem",
                  "position": 3,
                  "name": "Entities",
                  "item": canonicalUrl
                }
              ]
            },
            "accessMode": "restricted",
            "accessibilityControl": "authentication",
            "audience": {
              "@type": "Audience",
              "audienceType": "confidential_users"
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
  )
}

/* 
 * OBSOLETE FUNCTIONS (removed with React 19 migration):
 * - generateMetadata() function (replaced by React 19 native document metadata)
 * 
 * React 19 Native Features Used:
 * - Document metadata: <title>, <meta>, <link> tags automatically hoisted to <head>
 * - Maximum security: Enhanced protection with notranslate, cache-control, pragma, expires
 * - Confidential content schema: Structured data with audience restrictions
 * - Role-based access control: CONFIDENTIAL and ADMIN role validation preserved
 * - Breadcrumb navigation: Confidential section context
 * - Enhanced privacy: No-referrer policy and cache prevention
 * - Preserved all pagination, filtering, and data fetching functionality
 */