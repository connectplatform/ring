import { isFeatureEnabledOnServer } from '@/whitelabel/features'
import { Suspense } from "react"
import { auth } from "@/auth"
import type { SerializedEntity } from "@/features/entities/types"
import EntitiesWrapper from "@/components/wrappers/entities-wrapper"
import { isValidLocale, defaultLocale, generateHreflangAlternates } from '@/i18n-config'
import { getSEOMetadata } from '@/lib/seo-metadata'
import DesktopSidebar from '@/components/navigation/desktop-sidebar'
import RightSidebar from '@/features/layout/components/right-sidebar'
import EntitiesFiltersPanel from '@/components/entities/entities-filters-panel'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'

// 🚀 Ring-Native: DatabaseService + React 19
import { getEntitiesForRole } from '@/features/entities/services/get-entities'
import { connection } from 'next/server'

// Allow caching for better performance - entities don't change constantly
  
/**
 * 🚀 RING-NATIVE: Fetches entities with DatabaseService + React 19 cache()
 * READ operation - cached for performance
 *
 * @param session - The authenticated user session.
 * @param searchParams - The query parameters for fetching entities.
 * @returns Promise<{ entities: SerializedEntity[]; lastVisible: string | null; totalCount: number }>
 */
async function getEntities(
  session: any,
  searchParams: URLSearchParams
): Promise<any> {
  // Validate session first
  if (!session || !session.user) {
    console.log("getEntities: No valid session provided");
    throw new Error("UNAUTHORIZED");
  }

  console.log("getEntities: Starting Ring-native fetch", {
    sessionUserId: session.user.id,
    role: session.user.role
  });

  // Extract parameters
  const limit = Number.parseInt(searchParams.get('limit') || '20', 10);
  const startAfter = searchParams.get('startAfter') || undefined;

  // Use DatabaseService directly via service layer
  const { entities, lastVisible, totalCount } = await getEntitiesForRole({
    userRole: session.user.role as any,
    limit,
    startAfter
  });

  console.log("getEntities: Success", {
    entitiesCount: entities.length,
    hasMore: !!lastVisible,
    totalCount
  });

  return {
    entities,
    lastVisible,
    totalCount
  };
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
export default async function EntitiesPage(props: any) {
  await connection() // Next.js 16: opt out of prerendering

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

  // Get localized SEO data using the enhanced helper for GreenFood agricultural entities
  const seoData = await getSEOMetadata(locale, 'entities', {
    count: '20' // Default count, will be updated with actual data later
  })

  const canonicalUrl = `${process.env.NEXT_PUBLIC_API_URL || "https://greenfood.ck.ua"}/${locale}/entities`;
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

  // Initialize variables for entities and error handling
  let entities: SerializedEntity[] = []
  let lastVisible: string | null = null
  let totalCount = 0
  let error: string | null = null

  // Only fetch entities if user is authenticated
  if (session && session.user) {
    try {
      // 🚀 RING-NATIVE: Fetch entities with DatabaseService + cache()
      const data = await getEntities(session, apiSearchParams)
      entities = data.entities
      lastVisible = data.lastVisible
      totalCount = data.totalCount
      
      console.log(`[Entities Page] Loaded ${entities.length} entities`);
      
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
  }

  // Update SEO data with actual entity count if available
  const finalSeoData = totalCount > 0 ? await getSEOMetadata(locale, 'entities.list', {
    count: totalCount.toString()
  }) : seoData

  return (
    <>
      {/* React 19 Native Document Metadata with GreenFood Agricultural Focus */}
      <title>{finalSeoData?.title || 'Agricultural Entities - GreenFood Platform'}</title>
      <meta name="description" content={finalSeoData?.description || 'Discover farms, cooperatives, and food producers in sustainable agriculture. Connect with agricultural entities focused on food quality and environmental sustainability.'} />
      {finalSeoData?.keywords && (
        <meta name="keywords" content={finalSeoData.keywords.join(', ')} />
      )}
      <link rel="canonical" href={finalSeoData?.canonical || canonicalUrl} />

      {/* OpenGraph metadata */}
      <meta property="og:title" content={finalSeoData?.ogTitle || finalSeoData?.title || 'Agricultural Entities - GreenFood Platform'} />
      <meta property="og:description" content={finalSeoData?.ogDescription || finalSeoData?.description || 'Discover farms, cooperatives, and food producers in sustainable agriculture'} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content={locale === 'uk' ? 'uk_UA' : 'en_US'} />
      <meta property="og:alternate_locale" content={locale === 'uk' ? 'en_US' : 'uk_UA'} />
      <meta property="og:site_name" content="GreenFood Platform" />
      <meta property="og:image" content={finalSeoData?.ogImage || "/images/og-default.jpg"} />
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@GreenFoodPlatform" />
      <meta name="twitter:title" content={finalSeoData?.twitterTitle || finalSeoData?.title || 'Agricultural Entities'} />
      <meta name="twitter:description" content={finalSeoData?.twitterDescription || finalSeoData?.description || 'Discover farms, cooperatives, and food producers in sustainable agriculture'} />
      <meta name="twitter:image" content={finalSeoData?.twitterImage || "/images/og-default.jpg"} />

      {/* Additional SEO metadata */}
      <meta name="robots" content="index, follow" />
      <meta name="author" content="GreenFood Platform" />
      <meta name="keywords" content="agricultural entities, farms, cooperatives, food producers, sustainable agriculture, organic farming, GreenFood platform, agricultural directory" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />

      {/* Hreflang alternates */}
      {Object.entries(alternates).map(([lang, url]) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={url as string} />
      ))}

      {/* GreenFood Agricultural Entities Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": "Agricultural Entities - GreenFood Platform",
            "description": "Directory of agricultural companies, farms, cooperatives, and food producers focused on sustainable agriculture and food quality",
            "url": canonicalUrl,
            "mainEntity": {
              "@type": "WebPageElement",
              "name": "Agricultural Entities Directory",
              "description": "Browse and connect with agricultural entities committed to sustainable farming practices"
            },
            "breadcrumb": {
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": "Home",
                  "item": process.env.NEXT_PUBLIC_API_URL || "https://greenfood.ck.ua"
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": "Agricultural Entities",
                  "item": canonicalUrl
                }
              ]
            },
            "audience": {
              "@type": "Audience",
              "audienceType": "agricultural_professionals"
            },
            "about": [
              {
                "@type": "Thing",
                "name": "Sustainable Agriculture",
                "description": "Modern farming practices focused on environmental sustainability and food quality"
              },
              {
                "@type": "Thing",
                "name": "Agricultural Cooperatives",
                "description": "Collaborative farming organizations and producer cooperatives"
              },
              {
                "@type": "Thing",
                "name": "Food Production",
                "description": "Companies involved in food processing and agricultural product manufacturing"
              },
              {
                "@type": "Thing",
                "name": "Organic Farming",
                "description": "Chemical-free agricultural practices and organic food production"
              }
            ],
            "publisher": {
              "@type": "Organization",
              "name": "GreenFood Platform",
              "url": process.env.NEXT_PUBLIC_API_URL || "https://greenfood.ck.ua"
            }
          })
        }}
      />

      <div className="min-h-screen bg-background">
        {/* Desktop Layout - Three columns, hidden on iPad and mobile */}
        <div className="hidden lg:grid lg:grid-cols-[280px_1fr_320px] gap-6 min-h-screen">
          {/* Left Sidebar - Navigation */}
          <div>
            <DesktopSidebar />
          </div>

          {/* Main Content - Entity Feed */}
          <div>
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
                totalPages={Math.ceil(totalCount / limit)}
                totalEntities={totalCount}
                initialLimit={limit}
                initialSort={sort}
                initialFilter={filter}
              />
            </Suspense>
          </div>

          {/* Right Sidebar - Filters */}
          <div>
            <RightSidebar title="Filters">
              <EntitiesFiltersPanel
                initialFilters={{
                  search: filter
                }}
                resultCount={totalCount}
              />
            </RightSidebar>
          </div>
        </div>

        {/* iPad Layout - Two columns (sidebar + feed), hidden on mobile and desktop */}
        <div className="hidden md:grid md:grid-cols-[280px_1fr] lg:hidden gap-6 min-h-screen">
          {/* Left Sidebar - Navigation */}
          <div>
            <DesktopSidebar />
          </div>

          {/* Main Content - Entity Feed */}
          <div className="relative">
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
                totalPages={Math.ceil(totalCount / limit)}
                totalEntities={totalCount}
                initialLimit={limit}
                initialSort={sort}
                initialFilter={filter}
              />
            </Suspense>

            {/* Floating Sidebar Toggle for Filters (iPad only) */}
            <FloatingSidebarToggle>
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Filters</h3>
                <EntitiesFiltersPanel
                  initialFilters={{
                    search: filter
                  }}
                  resultCount={totalCount}
                />
              </div>
            </FloatingSidebarToggle>
          </div>
        </div>

        {/* Mobile Layout - Single column, hidden on iPad and desktop */}
        <div className="md:hidden px-4">
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
              totalPages={Math.ceil(totalCount / limit)}
              totalEntities={totalCount}
              initialLimit={limit}
              initialSort={sort}
              initialFilter={filter}
            />
          </Suspense>

          {/* Floating Sidebar Toggle for Filters (Mobile only) */}
          <FloatingSidebarToggle>
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Filters</h3>
              <EntitiesFiltersPanel
                initialFilters={{
                  search: filter
                }}
                resultCount={totalCount}
              />
            </div>
          </FloatingSidebarToggle>
        </div>
      </div>
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
