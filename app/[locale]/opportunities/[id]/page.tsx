import React, { Suspense } from 'react'
import { redirect, notFound } from 'next/navigation'
import { getServerAuthSession } from '@/auth'
import { cookies, headers } from 'next/headers'
import { Opportunity, Entity, Attachment } from '@/types'
import { UserRole } from '@/features/auth/types'
import OpportunitiesWrapper from '@/components/opportunities-wrapper'
import { ROUTES } from '@/constants/routes'
import { Timestamp } from 'firebase/firestore'
import { LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates, Locale } from '@/utils/i18n-server'

// Force dynamic rendering for this page to ensure fresh data on every request
export const dynamic = 'force-dynamic'

// Define the type for the route params
type OpportunityParams = { id: string };

/**
 * Fetches opportunity data by its ID from the API.
 * 
 * @param session - The authenticated user session.
 * @param id - The unique identifier of the opportunity to fetch.
 * @returns Promise<{ opportunity: Opportunity | null; entity: Entity | null }> - A promise that resolves to the opportunity and associated entity data.
 * @throws Error if there's a problem fetching the opportunity data.
 */
async function getOpportunityData(
  session: any,
  id: string
): Promise<{ opportunity: Opportunity | null; entity: Entity | null }> {
  console.log('getOpportunityData: Starting fetch', { sessionUserId: session.user.id, role: session.user.role, opportunityId: id });
  
  const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/api/opportunities/${id}`);
  console.log('getOpportunityData: Fetching from URL', { url: url.toString() });

  try {
    const res = await fetch(url, { 
      cache: 'no-store',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Cookie': cookies().toString(),
      },
    });
    
    console.log('getOpportunityData: Fetch response received', { 
      status: res.status, 
      ok: res.ok,
      statusText: res.statusText
    });

    if (!res.ok) {
      if (res.status === 401) throw new Error('UNAUTHORIZED');
      if (res.status === 403) throw new Error('PERMISSION_DENIED');
      if (res.status === 404) throw new Error('NOT_FOUND');
      throw new Error('FETCH_FAILED');
    }

    const data = await res.json();
    console.log('getOpportunityData: Data fetched successfully', { 
      opportunityExists: !!data.opportunity,
      entityExists: !!data.entity
    });
    return { opportunity: data.opportunity, entity: data.entity };
  } catch (error) {
    console.error('getOpportunityData: Error during fetch:', error);
    throw error;
  }
}

/**
 * Renders the opportunity details page.
 * 
 * User steps:
 * 1. User navigates to the opportunity details page with a specific ID.
 * 2. The page checks user authentication and authorization.
 * 3. If authorized, the page fetches and displays the opportunity details.
 * 4. If the opportunity is confidential, it checks for appropriate user role.
 * 5. The page displays the opportunity details or an error message.
 * 
 * @param props - The page properties including params and searchParams as Promises.
 * @returns Promise<React.ReactNode> - A promise that resolves to the rendered page content.
 */
export default async function OpportunityPage(props: LocalePageProps<OpportunityParams>): Promise<React.ReactNode> {
  console.log('OpportunityPage: Starting');

  // Resolve params and searchParams
  const params = await props.params;
  const searchParams = await props.searchParams;

  // Extract and validate locale
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale;
  console.log('OpportunityPage: Using locale', locale);

  // Load translations for React 19 metadata
  const translations = loadTranslations(locale);

  console.log('Params:', params);
  console.log('Search Params:', searchParams);

  const { id } = params;

  const cookieStore = await cookies()
  const headersList = await headers()
  const token = cookieStore.get("token");
  const userAgent = headersList.get('user-agent')

  console.log('OpportunityPage: Request details', {
    opportunityId: id,
    searchParams,
    locale,
    userAgent,
    hasToken: !!token
  });

  console.log('OpportunityPage: Authenticating session');
  const session = await getServerAuthSession();
  console.log('OpportunityPage: Session authenticated', { sessionExists: !!session, userId: session?.user?.id, role: session?.user?.role });

  if (!session) {
    console.log('OpportunityPage: No session, redirecting to login');
    redirect(ROUTES.LOGIN(locale))
  }

  let opportunity: Opportunity | null = null
  let entity: Entity | null = null
  let error: string | null = null

  // Prepare fallback metadata
  let title = (translations as any).metadata?.opportunityDetails || 'Opportunity Details | Ring App';
  let description = (translations as any).metaDescription?.opportunityDetails || 'View opportunity details in the Ring App ecosystem.';
  let canonicalUrl = `https://ring.ck.ua/${locale}/opportunities/${id}`;
  const alternates = generateHreflangAlternates(`/opportunities/${id}`);

  try {
    console.log('OpportunityPage: Fetching Opportunity');
    const data = await getOpportunityData(session, id)
    opportunity = data.opportunity
    entity = data.entity
    console.log('OpportunityPage: Opportunity fetched successfully', { opportunityId: opportunity?.id, entityId: entity?.id });

    if (opportunity?.isConfidential && session.user?.role !== UserRole.CONFIDENTIAL && session.user?.role !== UserRole.ADMIN) {
      console.log('OpportunityPage: Unauthorized access to confidential opportunity, redirecting');
      redirect(ROUTES.UNAUTHORIZED(locale))
    }

    if (!entity) {
      console.error('OpportunityPage: Associated entity not found');
      throw new Error("Associated organization not found");
    }

    // Generate opportunity-specific metadata
    if (opportunity) {
      title = `${opportunity.title} | Ring App`;
      description = opportunity.briefDescription || opportunity.fullDescription || `Learn more about this opportunity: ${opportunity.title}`;
    }

  } catch (e) {
    console.error("OpportunityPage: Error fetching Opportunity:", e)
    if (e instanceof Error) {
      console.error('OpportunityPage: Error details', { message: e.message, stack: e.stack });
      if (e.message === 'UNAUTHORIZED') {
        console.log('OpportunityPage: Unauthorized, redirecting to login');
        redirect(ROUTES.LOGIN(locale))
      } else if (e.message === 'PERMISSION_DENIED') {
        error = "You don't have permission to view this Opportunity. Please contact an administrator."
      } else if (e.message === 'NOT_FOUND') {
        return notFound()
      } else if (e.message === 'FETCH_FAILED') {
        error = "Failed to load Opportunity. Please try again later."
      } else {
        error = "An unexpected error occurred. Please try again later."
      }
    } else {
      error = "An unexpected error occurred. Please try again later."
    }
  }

  console.log('OpportunityPage: Rendering', { hasError: !!error, hasOpportunity: !!opportunity, hasEntity: !!entity });

  return (
    <>
      {/* React 19 Native Document Metadata - Opportunity-Specific */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      
      {/* OpenGraph metadata */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="article" />
      <meta property="og:locale" content={locale === 'uk' ? 'uk_UA' : 'en_US'} />
      <meta property="og:alternate_locale" content={locale === 'uk' ? 'en_US' : 'uk_UA'} />
      
      {/* Opportunity-specific OpenGraph data */}
      {entity?.logo && <meta property="og:image" content={entity.logo} />}
      {opportunity?.type && <meta property="article:section" content={opportunity.type} />}
      {opportunity?.tags && opportunity.tags.map((tag, index) => (
        <meta key={index} property="article:tag" content={tag} />
      ))}
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {entity?.logo && <meta name="twitter:image" content={entity.logo} />}
      
      {/* SEO optimization for opportunity pages */}
      <meta name="robots" content="index, follow" />
      <meta name="googlebot" content="index, follow" />
      
      {/* Hreflang alternates */}
      {Object.entries(alternates).map(([lang, url]) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={url} />
      ))}

      {/* Opportunity-specific structured data */}
      {opportunity && entity && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "JobPosting",
              "title": opportunity.title,
              "description": opportunity.fullDescription || opportunity.briefDescription,
              "hiringOrganization": {
                "@type": "Organization",
                "name": entity.name,
                ...(entity.logo && { "logo": entity.logo }),
                ...(entity.website && { "url": entity.website })
              },
              "jobLocation": {
                "@type": "Place",
                "address": entity.location
              },
              "url": `https://ring.ck.ua/${locale}/opportunities/${opportunity.id}`,
              ...(opportunity.type && { "employmentType": opportunity.type }),
              "inLanguage": locale,
              "datePosted": opportunity.dateCreated
            })
          }}
        />
      )}

      <Suspense fallback={
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
        </div>
      }>
        <OpportunitiesWrapper 
          initialOpportunity={opportunity ? {
            ...opportunity,
            attachments: opportunity.attachments as Attachment[],
            visibility: opportunity.visibility,
            expirationDate: opportunity.expirationDate instanceof Timestamp ? opportunity.expirationDate : new Timestamp(0, 0)
          } : null}
          initialEntity={entity}
          initialError={error}
          lastVisible={null}
          initialLimit={20}
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
 * - Opportunity-specific metadata: Dynamic title and description based on opportunity data
 * - JobPosting structured data: Native <script> tag with JSON-LD for job search optimization
 * - Advanced OpenGraph: Entity logos, opportunity types, and tags
 * - Twitter Cards: Enhanced with entity branding
 * - SEO optimization: Index/follow for public opportunity pages
 * - Preserved all authentication, data fetching, and authorization logic
 */