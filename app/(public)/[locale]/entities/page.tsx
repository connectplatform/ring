import { isFeatureEnabledOnServer } from '@/whitelabel/features'
import { Suspense } from "react"
import { cookies } from "next/headers"
import { auth } from "@/auth"
import type { SerializedEntity } from "@/features/entities/types"
import EntitiesWrapper from "@/components/wrappers/entities-wrapper"
import { LocalePageProps } from "@/utils/page-props"
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates, type Locale } from '@/i18n-config'
import { getSEOMetadata } from '@/lib/seo-metadata'

// 🚀 Firebase Optimization Imports
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector'
import { prefetchPublicEntities, prefetchFeaturedEntities, prefetchPageData } from '@/lib/build-cache/prefetch-manager'
import { getCachedEntities } from '@/lib/build-cache/static-data-cache'

// Force dynamic rendering for this page to ensure fresh data on every request
export const dynamic = "force-dynamic"

type EntitiesParams = {}

// Metadata will be rendered inline using React 19 native approach

/**
 * 🚀 OPTIMIZED: Fetches entities with intelligent build-time caching
 *
 * @param session - The authenticated user session.
 * @param searchParams - The query parameters for fetching entities.
 * @returns Promise<{ entities: SerializedEntity[]; lastVisible: string | null; totalPages: number; totalEntities: number }>
 */
async function getEntities(
  session: any,
  searchParams: URLSearchParams,
): Promise<{ entities: SerializedEntity[]; lastVisible: string | null; totalPages: number; totalEntities: number }> {
  const phase = getCurrentPhase();
  
  // 🔥 BUILD-TIME OPTIMIZATION: Use cached/mock data during static generation
  if (shouldUseMockData() || (shouldUseCache() && phase.isBuildTime)) {
    console.log(`[Entities Optimization] Using ${phase.strategy} data for build-time generation`);
    
    const limit = Number.parseInt(searchParams.get('limit') || '20', 10);
    const page = Number.parseInt(searchParams.get('page') || '1', 10);
    
    try {
      // Use prefetched data during build
      let entities: any[] = [];
      
      if (limit <= 20 && page === 1) {
        // First page with standard limit - use prefetched data
        entities = await prefetchPublicEntities();
      } else {
        // Other pages - use cached data
        entities = await getCachedEntities({ 
          limit: Math.min(limit, 50), // Cap at 50 for build time
          isPublic: true 
        });
      }
      
      // Simulate pagination for build time
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedEntities = entities.slice(startIndex, endIndex);
      
      return {
        entities: paginatedEntities,
        lastVisible: paginatedEntities.length > 0 ? `build-cursor-${endIndex}` : null,
        totalPages: Math.ceil(entities.length / limit),
        totalEntities: entities.length
      };
      
    } catch (error) {
      console.warn('[Entities Optimization] Cache fallback failed, using empty data for build:', error);
      return {
        entities: [],
        lastVisible: null,
        totalPages: 1,
        totalEntities: 0
      };
    }
  }
  
  // 🔥 RUNTIME OPTIMIZATION: Use live data with authentication
  // Validate session first
  if (!session || !session.user) {
    console.log("getEntities: No valid session provided");
    throw new Error("UNAUTHORIZED");
  }

  console.log("getEntities: Starting live fetch", { 
    sessionUserId: session.user.id, 
    role: session.user.role,
    phase: phase.description
  });

  const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/api/entities`)
  url.search = searchParams.toString()

  try {
    const cookieStore = await cookies();
    const res = await fetch(url, {
      cache: shouldUseCache() ? "default" : "no-store", // 🚀 Allow caching in production
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        Cookie: cookieStore.toString(),
      },
      next: {
        revalidate: shouldUseCache() ? 300 : 0, // 🚀 5min revalidation when caching enabled
      },
    })

    if (!res.ok) {
      if (res.status === 401) throw new Error("UNAUTHORIZED")
      if (res.status === 403) throw new Error("PERMISSION_DENIED")
      throw new Error("FETCH_FAILED")
    }

    const data = await res.json()
    
    console.log(`[Entities Optimization] Live data fetched successfully: ${data.entities?.length || 0} entities`);
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
 * 2. If unauthenticated, shows intro with login form
 * 3. If authenticated, the page fetches and displays entities
 * 4. User can view, filter, and paginate through the entities
 *
 * @param props - The page properties including params and searchParams as Promises.
 */
export default async function EntitiesPage(props: LocalePageProps<EntitiesParams>) {
  if (!isFeatureEnabledOnServer('entities')) {
    return null
  }
  console.log("EntitiesPage: Starting")

  // Resolve params and searchParams
  const params = await props.params;
  const searchParams = await props.searchParams;

  // Extract and validate locale
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale;
  console.log('EntitiesPage: Using locale', locale);

  // Get localized SEO data using the enhanced helper
  const seoData = await getSEOMetadata(locale, 'entities', {
    count: '20' // Default count, will be updated with actual data later
  })
  
  const canonicalUrl = `${process.env.NEXT_PUBLIC_API_URL || "https://ring.ck.ua"}/${locale}/entities`;
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

  // Authenticate user (optional for intro gating)
  const session = await auth()

  // 🚀 PREFETCH OPTIMIZATION: Load page-specific data during build
  const phase = getCurrentPhase();
  if (phase.isBuildTime) {
    console.log('[Entities Page] Prefetching entities data for build optimization');
    
    // Trigger prefetch for this page type during build
    await prefetchPageData('entities');
  }

  // Initialize variables for entities and error handling
  let entities: SerializedEntity[] = []
  let lastVisible: string | null = null
  let totalPages = 0
  let totalEntities = 0
  let error: string | null = null

  // Only fetch entities if user is authenticated
  if (session && session.user) {
    try {
      // 🚀 OPTIMIZED: Fetch entities with intelligent caching
      const data = await getEntities(session, apiSearchParams)
      entities = data.entities
      lastVisible = data.lastVisible
      totalPages = data.totalPages
      totalEntities = data.totalEntities
      
      console.log(`[Entities Page] Loaded ${entities.length} entities using ${phase.strategy} strategy`);
      
    } catch (e) {
      console.error("EntitiesPage: Error fetching entities:", e)
      if (e instanceof Error) {
        if (e.message === "PERMISSION_DENIED") {
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
  } else {
    // For unauthenticated users, don't set an error - let the component handle the intro display
    console.log('EntitiesPage: No session found, will show intro');
    
    // 🚀 BUILD-TIME: Provide sample data for static generation even without auth
    if (phase.isBuildTime && shouldUseMockData()) {
      console.log('[Entities Page] Using mock data for unauthenticated build-time generation');
      try {
        const mockData = await getCachedEntities({ limit: 10, isPublic: true });
        entities = mockData.slice(0, 5); // Show fewer entities for intro
        totalEntities = 5;
        totalPages = 1;
      } catch (mockError) {
        console.warn('[Entities Page] Mock data fallback failed:', mockError);
      }
    }
  }

  // Update SEO data with actual entity count if available  
  const finalSeoData = totalEntities > 0 ? await getSEOMetadata(locale, 'entities.list', {
    count: totalEntities.toString()
  }) : seoData

  return (
    <>
      {/* React 19 Native Document Metadata with Localized SEO */}
      <title>{finalSeoData?.title || 'Professional Entities - Ring Platform'}</title>
      <meta name="description" content={finalSeoData?.description || 'Discover and connect with professional entities, organizations, and businesses on Ring platform.'} />
      {finalSeoData?.keywords && (
        <meta name="keywords" content={finalSeoData.keywords.join(', ')} />
      )}
      <link rel="canonical" href={finalSeoData?.canonical || canonicalUrl} />
      
      {/* OpenGraph metadata */}
      <meta property="og:title" content={finalSeoData?.ogTitle || finalSeoData?.title || 'Professional Entities - Ring Platform'} />
      <meta property="og:description" content={finalSeoData?.ogDescription || finalSeoData?.description || 'Discover and connect with professional entities'} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content={locale === 'uk' ? 'uk_UA' : 'en_US'} />
      <meta property="og:alternate_locale" content={locale === 'uk' ? 'en_US' : 'uk_UA'} />
      <meta property="og:site_name" content="Ring Platform" />
      <meta property="og:image" content={finalSeoData?.ogImage || "/images/og-default.jpg"} />
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@RingPlatform" />
      <meta name="twitter:title" content={finalSeoData?.twitterTitle || finalSeoData?.title || 'Professional Entities'} />
      <meta name="twitter:description" content={finalSeoData?.twitterDescription || finalSeoData?.description || 'Discover professional entities on Ring Platform'} />
      <meta name="twitter:image" content={finalSeoData?.twitterImage || "/images/og-default.jpg"} />
      
      {/* Additional SEO metadata */}
      <meta name="robots" content="index, follow" />
      <meta name="author" content="Ring Platform" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      
      {/* Hreflang alternates */}
      {Object.entries(alternates).map(([lang, url]) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={url as string} />
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
