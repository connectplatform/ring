import { Suspense } from "react"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { getServerAuthSession } from "@/auth"
import { ROUTES } from "@/constants/routes"
import type { Entity } from "@/types"
import EntitiesWrapper from "@/components/entities-wrapper"
import { LocalePageProps } from "@/utils/page-props"
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates, Locale } from '@/utils/i18n-server'

// Force dynamic rendering for this page to ensure fresh data on every request
export const dynamic = "force-dynamic"

type EntitiesParams = {}

/**
 * Fetches a paginated list of entities from the API.
 *
 * @param session - The authenticated user session.
 * @param searchParams - The query parameters for fetching entities.
 * @returns Promise<{ entities: Entity[]; lastVisible: string | null; totalPages: number; totalEntities: number }>
 */
async function getEntities(
  session: any,
  searchParams: URLSearchParams,
): Promise<{ entities: Entity[]; lastVisible: string | null; totalPages: number; totalEntities: number }> {
  // Validate session first
  if (!session || !session.user) {
    console.log("getEntities: No valid session provided");
    throw new Error("UNAUTHORIZED");
  }

  console.log("getEntities: Starting fetch", { sessionUserId: session.user.id, role: session.user.role })

  const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/api/entities`)
  url.search = searchParams.toString()

  try {
    const cookieStore = await cookies();
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        Cookie: cookieStore.toString(),
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
    console.error("getEntities: Error during fetch:", error)
    throw error
  }
}

/**
 * Renders the entities page with pagination.
 *
 * User steps:
 * 1. User navigates to the entities page
 * 2. The page authenticates the user and checks their role
 * 3. If authorized, the page fetches and displays entities
 * 4. User can view, filter, and paginate through the entities
 *
 * @param props - The page properties including params and searchParams as Promises.
 */
export default async function EntitiesPage(props: LocalePageProps<EntitiesParams>) {
  console.log("EntitiesPage: Starting")

  // Resolve params and searchParams
  const params = await props.params;
  const searchParams = await props.searchParams;

  // Extract and validate locale
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale;
  console.log('EntitiesPage: Using locale', locale);

  // React 19 metadata preparation
  const translations = loadTranslations(locale);
  const title = (translations as any).metadata?.entities || 'Entities | Ring App';
  const description = (translations as any).metaDescription?.entities || 'Browse and discover tech companies, startups, and organizations in the Cherkasy region ecosystem.';
  const canonicalUrl = `https://ring.ck.ua/${locale}/entities`;
  const alternates = generateHreflangAlternates('/entities');

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
  if (!session) {
    console.log("EntitiesPage: No session, redirecting to login")
    redirect(ROUTES.LOGIN(locale))
  }

  // Initialize variables for entities and error handling
  let entities: Entity[] = []
  let lastVisible: string | null = null
  let totalPages = 0
  let totalEntities = 0
  let error: string | null = null

  try {
    // Fetch entities
    const data = await getEntities(session, apiSearchParams)
    entities = data.entities
    lastVisible = data.lastVisible
    totalPages = data.totalPages
    totalEntities = data.totalEntities
  } catch (e) {
    console.error("EntitiesPage: Error fetching entities:", e)
    if (e instanceof Error) {
      // Handle specific error cases
      if (e.message === "UNAUTHORIZED") {
        redirect(ROUTES.LOGIN(locale))
      } else if (e.message === "PERMISSION_DENIED") {
        error = "You don't have permission to view entities. Please contact an administrator."
      } else if (e.message === "FETCH_FAILED") {
        error = "Failed to load entities. Please try again later."
      } else {
        error = "An unexpected error occurred. Please try again later."
      }
    } else {
      error = "An unexpected error occurred. Please try again later."
    }
  }

  return (
    <>
      {/* React 19 Native Document Metadata */}
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
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      
      {/* Hreflang alternates */}
      {Object.entries(alternates).map(([lang, url]) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={url} />
      ))}

      <Suspense
        fallback={
          <div className="flex justify-center items-center h-screen">
            <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
          </div>
        }
      >
        <EntitiesWrapper
          initialEntities={entities}
          initialError={error}
          page={page}
          lastVisible={lastVisible}
          totalPages={totalPages}
          totalEntities={totalEntities}
          initialLimit={limit}
          initialSort={sort}
          initialFilter={filter}
        />
      </Suspense>
    </>
  )
}

/* 
 * OBSOLETE FUNCTIONS (removed with React 19 migration):
 * - generateMetadata() function (replaced by React 19 native document metadata)
 * 
 * React 19 Native Features Used:
 * - Document metadata: <title>, <meta>, <link> tags automatically hoisted to <head>
 * - Automatic meta tag deduplication and precedence handling
 * - Native hreflang support for i18n
 * - Preserved all authentication, data fetching, and pagination logic
 */