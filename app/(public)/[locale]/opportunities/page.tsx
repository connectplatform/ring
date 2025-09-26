import React, { Suspense, JSX } from 'react'
import { headers } from 'next/headers'
import { auth } from "@/auth"
import { SerializedOpportunity } from '@/features/opportunities/types'
import OpportunitiesWrapper from '@/components/wrappers/opportunities-wrapper'
import { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates, type Locale } from '@/i18n-config'
import { isFeatureEnabledOnServer } from '@/whitelabel/features'
import { getSEOMetadata } from '@/lib/seo-metadata'
import OpportunitiesSearchClient from '@/components/opportunities/opportunities-search-client'

// Force dynamic rendering for this page to ensure fresh data on every request
export const dynamic = 'force-dynamic'

// Define the type for the route params
type OpportunitiesParams = {};

// Metadata will be rendered inline using React 19 native approach

/**
 * Fetches a paginated list of opportunities from the API.
 * 
 * @param session - The authenticated user session.
 * @param searchParams - The query parameters for fetching opportunities.
 * @returns Promise<{ opportunities: Opportunity[]; lastVisible: string | null }> - A promise that resolves to the opportunities and the last visible item for pagination.
 * @throws Error if there's a problem fetching the opportunities or if the user is unauthorized.
 */
async function getOpportunities(
  session: any,
  searchParams: URLSearchParams
): Promise<{ opportunities: SerializedOpportunity[]; lastVisible: string | null }> {
  // Validate session first
  if (!session || !session.user) {
    console.log('getOpportunities: No valid session provided');
    throw new Error('UNAUTHORIZED');
  }

  console.log('getOpportunities: Starting direct service call', { sessionUserId: session.user.id, role: session.user.role });

  // Extract pagination and search parameters
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const startAfter = searchParams.get('startAfter') || undefined;

  // Extract search/filter parameters
  const query = searchParams.get('q') || undefined;
  const types = searchParams.get('types')?.split(',').filter(Boolean) || undefined;
  const categories = searchParams.get('categories')?.split(',').filter(Boolean) || undefined;
  const location = searchParams.get('location') || undefined;
  const budgetMin = searchParams.get('budgetMin') ? parseInt(searchParams.get('budgetMin')!) : undefined;
  const budgetMax = searchParams.get('budgetMax') ? parseInt(searchParams.get('budgetMax')!) : undefined;
  const priority = searchParams.get('priority') as 'urgent' | 'normal' | 'low' | undefined;
  const deadline = searchParams.get('deadline') as 'today' | 'week' | 'month' | undefined;
  const entityVerified = searchParams.get('entityVerified') === 'true' ? true :
                        searchParams.get('entityVerified') === 'false' ? false : undefined;
  const hasDeadline = searchParams.get('hasDeadline') === 'true' ? true :
                     searchParams.get('hasDeadline') === 'false' ? false : undefined;

  try {
    // Import and call the service function directly instead of making HTTP request
    const { getOpportunitiesForRole } = await import('@/features/opportunities/services/get-opportunities');
    const userRole = session.user.role;

    console.log('getOpportunities: Calling service with params', {
      userRole,
      limit,
      startAfter,
      query,
      types,
      categories,
      location,
      budgetMin,
      budgetMax,
      priority,
      deadline,
      entityVerified,
      hasDeadline
    });

    const result = await getOpportunitiesForRole({
      userRole,
      limit,
      startAfter,
      query,
      types,
      categories,
      location,
      budgetMin,
      budgetMax,
      priority,
      deadline,
      entityVerified,
      hasDeadline
    });

    console.log('getOpportunities: Data fetched successfully', {
      opportunityCount: result.opportunities.length,
      lastVisible: result.lastVisible,
    });
    return result;
  } catch (error) {
    console.error('getOpportunities: Error during service call:', error);
    throw error;
  }
}

/**
 * Renders the opportunities page with pagination.
 * 
 * User steps:
 * 1. User navigates to the opportunities page.
 * 2. If unauthenticated, shows intro with login form.
 * 3. If authenticated, the page fetches and displays opportunities.
 * 4. User can interact with pagination controls to load more opportunities.
 * 
 * @param props - The page properties including params and searchParams as Promises.
 * @returns Promise<JSX.Element> - The rendered page content.
 */
export default async function OpportunitiesPage(props: LocalePageProps<OpportunitiesParams>): Promise<JSX.Element> {
  if (!isFeatureEnabledOnServer('opportunities')) {
    return (<></>) as any
  }
  console.log('OpportunitiesPage: Starting');

  // Resolve params and searchParams
  const params = await props.params;
  const searchParams = await props.searchParams;

  // Extract and validate locale
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale;
  console.log('OpportunitiesPage: Using locale', locale);

  // Get localized SEO data using the enhanced helper
  const seoData = await getSEOMetadata(locale, 'opportunities', {
    count: '20' // Default count, will be updated with actual data later
  })
  
  const canonicalUrl = `${process.env.NEXT_PUBLIC_API_URL || "https://ring.ck.ua"}/${locale}/opportunities`;
  const alternates = generateHreflangAlternates('/opportunities');

  console.log('Params:', params);
  console.log('Search Params:', searchParams);

  const limit = parseInt(searchParams.limit as string, 10) || 20;
  const startAfter = searchParams.startAfter as string | undefined;

  const apiSearchParams = new URLSearchParams({
    limit: limit.toString(),
    ...(startAfter && { startAfter }),
  });

  const headersList = await headers()
  const userAgent = headersList.get('user-agent')

  console.log('OpportunitiesPage: Request details', {
    params,
    searchParams,
    locale,
    limit,
    startAfter,
    userAgent
  });

  const session = await auth();
  console.log('OpportunitiesPage: Session retrieved', { sessionExists: !!session, userId: session?.user?.id, role: session?.user?.role });

  return (
    <>
      {/* React 19 Native Document Metadata with Localized SEO */}
      <title>{seoData?.title || 'Business Opportunities - Ring Platform'}</title>
      <meta name="description" content={seoData?.description || 'Discover and create business opportunities, partnerships, and collaborations on Ring platform.'} />
      {seoData?.keywords && (
        <meta name="keywords" content={seoData.keywords.join(', ')} />
      )}
      <link rel="canonical" href={seoData?.canonical || canonicalUrl} />
      
      {/* OpenGraph metadata */}
      <meta property="og:title" content={seoData?.ogTitle || seoData?.title || 'Business Opportunities - Ring Platform'} />
      <meta property="og:description" content={seoData?.ogDescription || seoData?.description || 'Discover business opportunities and partnerships'} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content={locale === 'uk' ? 'uk_UA' : 'en_US'} />
      <meta property="og:alternate_locale" content={locale === 'uk' ? 'en_US' : 'uk_UA'} />
      <meta property="og:site_name" content="Ring Platform" />
      <meta property="og:image" content={seoData?.ogImage || "/images/og-default.jpg"} />
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@RingPlatform" />
      <meta name="twitter:title" content={seoData?.twitterTitle || seoData?.title || 'Business Opportunities'} />
      <meta name="twitter:description" content={seoData?.twitterDescription || seoData?.description || 'Discover opportunities on Ring Platform'} />
      <meta name="twitter:image" content={seoData?.twitterImage || "/images/og-default.jpg"} />
      
      {/* Additional SEO metadata */}
      <meta name="robots" content="index, follow" />
      <meta name="author" content="Ring Platform" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      
      {/* Hreflang alternates */}
      {Object.entries(alternates).map(([lang, url]) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={url as string} />
      ))}

      <Suspense fallback={
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
        </div>
      }>
        <OpportunitiesContent
          searchParams={apiSearchParams}
          limit={limit}
          session={session}
          locale={locale}
        />
      </Suspense>
    </>
  )
}

/**
 * Fetches and renders the opportunities content.
 * 
 * @param searchParams - The URL search parameters for fetching opportunities.
 * @param limit - The number of opportunities to fetch.
 * @param session - The user's session data.
 * @returns Promise<JSX.Element> - The rendered opportunities content.
 */
async function OpportunitiesContent({ searchParams, limit, session, locale }: {
  searchParams: URLSearchParams,
  limit: number,
  session: any,
  locale: string
}): Promise<JSX.Element> {
  let opportunities: SerializedOpportunity[] = []
  let lastVisible: string | null = null
  let error: string | null = null

  // Only fetch opportunities if user is authenticated
  if (session && session.user) {
    const validRoles = ['visitor','subscriber','member','confidential','admin'] as const;
    const userRole = session.user?.role as (typeof validRoles)[number] | undefined;
    if (!userRole || !validRoles.includes(userRole)) {
      error = "Your role is invalid or missing. Please re-login or contact support.";
      console.log('OpportunitiesContent: Invalid or missing role, skipping fetch');
    } else {
      try {
        console.log('OpportunitiesContent: Fetching opportunities');
        const data = await getOpportunities(session, searchParams)
        opportunities = data.opportunities
        lastVisible = data.lastVisible
        console.log('OpportunitiesContent: Opportunities fetched successfully', { opportunityCount: opportunities.length, lastVisible });
      } catch (e) {
        console.error("OpportunitiesContent: Error fetching opportunities:", e)
        if (e instanceof Error) {
          console.error('OpportunitiesContent: Error details', { message: e.message, stack: e.stack });
          if (e.message === 'UNAUTHORIZED') {
            error = "You are not authorized to view opportunities. Please log in."
          } else if (e.message === 'PERMISSION_DENIED') {
            error = "You don't have permission to view opportunities. Please contact an administrator."
          } else {
            error = "Failed to load opportunities. Please try again later."
          }
        } else {
          error = "An unexpected error occurred. Please try again later."
        }
      }
    }
  } else {
    // For unauthenticated users, don't set an error - let the component handle the intro display
    console.log('OpportunitiesContent: No session found, will show intro');
  }

  console.log('OpportunitiesContent: Rendering', { hasError: !!error, opportunityCount: opportunities.length, lastVisible });

  return (
    <div className="min-h-screen bg-background">
      {/* Search Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="max-w-4xl mx-auto space-y-4">
            <OpportunitiesSearchClient locale={locale} />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Main Content */}
          <div className="flex-1">
            <OpportunitiesWrapper
              initialOpportunities={opportunities}
              initialError={error}
              lastVisible={lastVisible}
              initialLimit={limit}
            />
          </div>
        </div>
      </div>
    </div>
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
