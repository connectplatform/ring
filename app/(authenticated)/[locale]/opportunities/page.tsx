import React, { Suspense, JSX } from 'react'
import { headers } from 'next/headers'
import { getServerAuthSession } from "@/auth"
import { SerializedOpportunity } from '@/features/opportunities/types'
import OpportunitiesWrapper from '@/components/wrappers/opportunities-wrapper'
import { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates, type Locale } from '@/i18n-config'
import { isFeatureEnabledOnServer } from '@/whitelabel/features'
import { getSEOMetadata } from '@/utils/seo-metadata'

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
  
  // Extract pagination parameters
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const startAfter = searchParams.get('startAfter') || undefined;

  try {
    // Import and call the service function directly instead of making HTTP request
    const { getOpportunitiesForRole } = await import('@/features/opportunities/services/get-opportunities');
    const userRole = session.user.role;
    
    console.log('getOpportunities: Calling service with params', { userRole, limit, startAfter });
    const result = await getOpportunitiesForRole({ userRole, limit, startAfter });
    
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
 * 2. The middleware checks user authentication and redirects if necessary.
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

  // React 19 metadata preparation
  const translations = loadTranslations(locale);
  const title = (translations as any).metadata?.opportunities || 'Opportunities | Ring App';
  const description = (translations as any).metaDescription?.opportunities || 'Discover tech opportunities, jobs, partnerships, and collaborations in the Cherkasy region ecosystem.';
  const canonicalUrl = `https://ring.ck.ua/${locale}/opportunities`;
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

  const session = await getServerAuthSession();
  console.log('OpportunitiesPage: Session retrieved', { sessionExists: !!session, userId: session?.user?.id, role: session?.user?.role });

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
async function OpportunitiesContent({ searchParams, limit, session }: { searchParams: URLSearchParams, limit: number, session: any }): Promise<JSX.Element> {
  let opportunities: SerializedOpportunity[] = []
  let lastVisible: string | null = null
  let error: string | null = null

  // Validate session before proceeding
  if (!session || !session.user) {
    error = "You must be logged in to view opportunities. Please log in.";
    console.log('OpportunitiesContent: No valid session, skipping fetch');
  } else {
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
  }

  console.log('OpportunitiesContent: Rendering', { hasError: !!error, opportunityCount: opportunities.length, lastVisible });

  return (
    <OpportunitiesWrapper 
      initialOpportunities={opportunities} 
      initialError={error}
      lastVisible={lastVisible}
      initialLimit={limit}
    />
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