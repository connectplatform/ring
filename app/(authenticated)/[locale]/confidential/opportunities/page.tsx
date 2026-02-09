import React from "react"
import { redirect, notFound } from "next/navigation"
import { cookies } from "next/headers"
import { auth } from "@/auth"
import { ROUTES } from "@/constants/routes"
import { UserRole } from "@/features/auth/types"
import type { Opportunity } from "@/types"
import ConfidentialOpportunitiesWrapper from "@/components/wrappers/confidential-opportunities-wrapper"
import { LocalePageProps } from "@/utils/page-props"
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates, type Locale } from '@/i18n-config'
import { connection } from 'next/server'

// Force dynamic rendering for this page to ensure fresh data on every request

// Define the type for the route params (empty object since this is not a dynamic route)
type OpportunitiesParams = Record<string, never>;

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
  console.log("getConfidentialOpportunities: Starting fetch", {
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
    console.error("getConfidentialOpportunities: Error during fetch:", error)
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

  console.log("ConfidentialOpportunitiesPage: Starting")

  // Resolve params and searchParams
  const params = await props.params;
  const searchParams = await props.searchParams;

  // Extract and validate locale
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale;
  console.log('ConfidentialOpportunitiesPage: Using locale', locale);

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
  const session = await auth()

  // Check user authorization
  if (!session || (session.user?.role !== UserRole.CONFIDENTIAL && session.user?.role !== UserRole.ADMIN)) {
    console.log("ConfidentialOpportunitiesPage: Unauthorized access, redirecting")
    redirect(ROUTES.UNAUTHORIZED(locale))
  }

  // React 19 metadata for confidential pages
  const title = (translations as any).metadata?.confidentialOpportunities || 'Confidential Opportunities | Ring App';
  const description = (translations as any).metaDescription?.confidentialOpportunities || 'Secure access to confidential opportunities in the Ring App ecosystem.';
  const canonicalUrl = `${process.env.NEXT_PUBLIC_API_URL}/${locale}/confidential/opportunities`;
  const alternates = generateHreflangAlternates('/confidential/opportunities');

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
    console.error("ConfidentialOpportunitiesPage: Error fetching confidential opportunities:", e)
    if (e instanceof Error) {
      // Handle specific error cases
      if (e.message === "UNAUTHORIZED") {
        redirect(ROUTES.LOGIN(locale))
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

  if (!page) return notFound()

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

      {/* Confidential opportunities structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": "Confidential Opportunities - Ring Platform",
            "description": description,
            "url": canonicalUrl,
            "mainEntity": {
              "@type": "WebPageElement",
              "name": "Confidential Opportunities",
              "description": "Secure directory of confidential opportunities with restricted access"
            },
            "breadcrumb": {
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": "Home",
                  "item": process.env.NEXT_PUBLIC_API_URL || "https://ring.ck.ua"
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": "Confidential",
                  "item": `${process.env.NEXT_PUBLIC_API_URL || "https://ring.ck.ua"}${locale}/confidential/opportunities`
                },
                {
                  "@type": "ListItem",
                  "position": 3,
                  "name": "Opportunities",
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
  )
}

/* 
 * OBSOLETE FUNCTIONS (removed with React 19 migration):
 * - generateMetadata() function (replaced by React 19 native document metadata)
 * 
 * React 19 Native Features Used:
 * - Document metadata: <title>, <meta>, <link> tags automatically hoisted to <head>
 * - Maximum security: Enhanced protection with notranslate, cache-control, pragma, expires
 * - Confidential opportunities schema: Structured data with audience restrictions
 * - Role-based access control: CONFIDENTIAL and ADMIN role validation preserved
 * - Breadcrumb navigation: Confidential section context
 * - Enhanced privacy: No-referrer policy and cache prevention
 * - Preserved all pagination, filtering, and opportunity data fetching functionality
 */