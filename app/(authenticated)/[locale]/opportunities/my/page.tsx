import React, { Suspense } from 'react'
import { headers } from 'next/headers'
import { auth } from "@/auth"
import { SerializedOpportunity } from '@/features/opportunities/types'
import MyOpportunitiesWrapper from '@/components/wrappers/my-opportunities-wrapper'
import { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates } from '@/i18n-config'
import { getSEOMetadata } from '@/lib/seo-metadata'
import { redirect } from 'next/navigation'

// Force dynamic rendering for user-specific data
export const dynamic = 'force-dynamic'

/**
 * My Opportunities Page
 * Shows opportunities created by the current user
 * Following the Entity-Opportunity Mapping paradigm from PLATFORM-PHILOSOPHY.md
 */
async function getMyOpportunities(
  session: any,
  searchParams: URLSearchParams
): Promise<{ opportunities: SerializedOpportunity[]; lastVisible: string | null; counts: { created: number; applied: number } }> {
  if (!session || !session.user) {
    console.log('getMyOpportunities: No valid session');
    throw new Error('UNAUTHORIZED');
  }

  console.log('getMyOpportunities: Fetching for user', { userId: session.user.id });
  
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const startAfter = searchParams.get('startAfter') || undefined;
  const filterType = (searchParams.get('filter') || 'all') as 'all' | 'created' | 'applied';

  try {
    const { getMyOpportunities: getMyOpportunitiesService } = await import('@/features/opportunities/services/get-user-opportunities');
    const result = await getMyOpportunitiesService(filterType, limit, startAfter);
    
    console.log('getMyOpportunities: Fetched successfully', { 
      count: result.opportunities.length,
      counts: result.counts
    });
    
    return result;
  } catch (error) {
    console.error('getMyOpportunities: Error:', error);
    throw error;
  }
}

export default async function MyOpportunitiesPage(props: LocalePageProps<{}>) {
  console.log('MyOpportunitiesPage: Starting');

  // Resolve params and searchParams
  const params = await props.params;
  const searchParams = await props.searchParams;

  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale;
  
  // Get session first to check authentication
  const session = await auth();
  
  // Redirect to login if not authenticated
  if (!session || !session.user) {
    redirect(`/${locale}/auth/login?from=${encodeURIComponent(`/${locale}/opportunities/my`)}`);
  }

  // Get SEO metadata
  const seoData = await getSEOMetadata(locale, 'opportunities.my', {
    userName: session.user.name || 'User'
  });
  
  const canonicalUrl = `${process.env.NEXT_PUBLIC_API_URL || "https://ring.ck.ua"}/${locale}/opportunities/my`;
  const alternates = generateHreflangAlternates('/opportunities/my');

  const limit = parseInt(searchParams.limit as string, 10) || 20;
  const startAfter = searchParams.startAfter as string | undefined;
  const filter = searchParams.filter as string || 'all';

  const apiSearchParams = new URLSearchParams({
    limit: limit.toString(),
    filter,
    ...(startAfter && { startAfter }),
  });

  return (
    <>
      {/* React 19 Native Document Metadata */}
      <title>{seoData?.title || 'My Opportunities - Ring Platform'}</title>
      <meta name="description" content={seoData?.description || 'Manage your created opportunities and track applications on Ring platform.'} />
      {seoData?.keywords && (
        <meta name="keywords" content={seoData.keywords.join(', ')} />
      )}
      <link rel="canonical" href={seoData?.canonical || canonicalUrl} />
      
      {/* OpenGraph metadata */}
      <meta property="og:title" content={seoData?.ogTitle || seoData?.title || 'My Opportunities - Ring Platform'} />
      <meta property="og:description" content={seoData?.ogDescription || seoData?.description || 'Manage your opportunities'} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content={locale === 'uk' ? 'uk_UA' : 'en_US'} />
      <meta property="og:site_name" content="Ring Platform" />
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@RingPlatform" />
      <meta name="twitter:title" content={seoData?.twitterTitle || seoData?.title || 'My Opportunities'} />
      <meta name="twitter:description" content={seoData?.twitterDescription || seoData?.description || 'Manage your opportunities'} />
      
      {/* Hreflang alternates */}
      {Object.entries(alternates).map(([lang, url]) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={url as string} />
      ))}

      <Suspense fallback={
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
        </div>
      }>
        <MyOpportunitiesContent 
          searchParams={apiSearchParams}
          limit={limit}
          session={session}
        />
      </Suspense>
    </>
  )
}

async function MyOpportunitiesContent({ 
  searchParams, 
  limit, 
  session 
}: { 
  searchParams: URLSearchParams, 
  limit: number, 
  session: any 
}) {
  let opportunities: SerializedOpportunity[] = []
  let lastVisible: string | null = null
  let counts = { created: 0, applied: 0 }
  let error: string | null = null

  try {
    console.log('MyOpportunitiesContent: Fetching opportunities');
    const data = await getMyOpportunities(session, searchParams)
    opportunities = data.opportunities
    lastVisible = data.lastVisible
    counts = data.counts
    console.log('MyOpportunitiesContent: Fetched successfully', { count: opportunities.length, counts });
  } catch (e) {
    console.error("MyOpportunitiesContent: Error:", e)
    if (e instanceof Error) {
      if (e.message === 'UNAUTHORIZED') {
        error = "You must be logged in to view your opportunities."
      } else {
        error = "Failed to load your opportunities. Please try again later."
      }
    } else {
      error = "An unexpected error occurred."
    }
  }

  return (
    <MyOpportunitiesWrapper 
      initialOpportunities={opportunities} 
      initialError={error}
      lastVisible={lastVisible}
      initialLimit={limit}
      counts={counts}
    />
  )
}
