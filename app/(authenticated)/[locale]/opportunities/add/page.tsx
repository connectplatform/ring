import type { Metadata } from 'next'
import React, { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import AddOpportunityForm from '@/features/opportunities/components/add-opportunity'
import OpportunityFormWrapper from '@/components/wrappers/opportunity-form-wrapper'
import { auth } from '@/auth'
import { ROUTES } from '@/constants/routes'
import { UserRole } from '@/features/auth/types'
import { PageProps } from '@/types/next-page'
import { resolvePageProps } from '@/utils/page-props'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { connection } from 'next/server'
import { buildLocalizedMetadata, getSeoSiteBaseUrl, RING_PLATFORM_SEO } from '@/lib/seo-metadata'
import { logger } from '@/lib/logger'

// Role hierarchy for access control
const ROLE_HIERARCHY = {
  [UserRole.VISITOR]: 0,
  [UserRole.SUBSCRIBER]: 1,
  [UserRole.MEMBER]: 2,
  [UserRole.CONFIDENTIAL]: 3,
  [UserRole.ADMIN]: 4,
} as const

function addOpportunitySeoFallback(type?: string) {
  if (type === 'request') {
    return {
      title: 'Create Request | Ring Platform',
      description:
        'Create a request to find services, advice, or collaboration from the Ring Platform community.',
    }
  }
  if (type === 'offer') {
    return {
      title: 'Create Offer | Ring Platform',
      description: 'Post an official opportunity from your organization on Ring Platform.',
    }
  }
  if (type === 'cv') {
    return {
      title: 'Share Developer CV | Ring Platform',
      description: 'Share your developer profile and skills to connect with marketplace opportunities.',
    }
  }
  return {
    title: 'Add Opportunity | Ring Platform',
    description:
      'Add a new opportunity on Ring Platform — job postings, collaboration requests, and partnerships.',
  }
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ type?: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  const { type } = await searchParams
  const opportunityType = typeof type === 'string' ? type : undefined
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'opportunities.add',
    pathname: '/opportunities/add',
    fallback: addOpportunitySeoFallback(opportunityType),
    siteName: RING_PLATFORM_SEO.siteName,
    twitterSite: RING_PLATFORM_SEO.twitterSite,
    robots: { index: false, follow: false },
  })
}

/**
 * AddOpportunityPage component for adding new opportunities.
 * This component handles user authentication, permission checks, and renders the add opportunity form.
 * Now supports type-based routing for requests vs offers with proper role validation.
 * 
 * @param props - The page properties including params and searchParams.
 * 
 * User flow:
 * 1. User navigates to the add opportunity page with ?type=request or ?type=offer
 * 2. System checks for user authentication
 * 3. If not authenticated, user is redirected to login page
 * 4. If authenticated, system validates permissions for the opportunity type
 * 5. SUBSCRIBER users can create requests; MEMBER+ users can create both
 * 6. If user lacks permission, they're redirected to upgrade page
 */
export default async function AddOpportunityPage(props: PageProps) {
  await connection() // Next.js 16: opt out of prerendering

  logger.info('AddOpportunityPage: Starting');

  // Step 1: Resolve params and searchParams using our utility function
  const { params, searchParams } = await resolvePageProps(props);
  
  const validLocale: Locale = routing.locales.includes(params.locale as Locale) ? (params.locale as Locale) : (routing.defaultLocale as Locale);
  const type = searchParams.type as 'request' | 'offer' | 'cv' | undefined

  const headersList = await headers();
  logger.info('AddOpportunityPage: Request details', {
    params,
    searchParams,
    locale: validLocale,
    type,
    userAgent: headersList.get('user-agent'),
  });

  const cookieStore = await cookies();
  const token = cookieStore.get("token");
  const userAgent = headersList.get('user-agent');

  const baseUrl = getSeoSiteBaseUrl()
  const description = addOpportunitySeoFallback(typeof type === 'string' ? type : undefined).description
  const canonicalUrl =
    validLocale === routing.defaultLocale
      ? `${baseUrl}/opportunities/add${type ? `?type=${type}` : ''}`
      : `${baseUrl}/${validLocale}/opportunities/add${type ? `?type=${type}` : ''}`

  // Auth + role checks — all redirect() calls must be outside try/catch
  const session = await auth();
  if (!session) {
    logger.info('AddOpportunityPage: No session, redirecting to login');
    const returnTo = ROUTES.ADD_OPPORTUNITY(validLocale) + (type ? `?type=${type}` : '');
    redirect(ROUTES.LOGIN(validLocale) + `?callbackUrl=${encodeURIComponent(returnTo)}`);
  }

  const userRole = session.user?.role as UserRole;
  if (!userRole || ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[UserRole.SUBSCRIBER]) {
    logger.info('AddOpportunityPage: User lacks basic permission', { userRole });
    redirect(ROUTES.REGISTER(validLocale) + `?callbackUrl=${encodeURIComponent(ROUTES.ADD_OPPORTUNITY(validLocale) + (type ? `?type=${type}` : ''))}`);
  }
  if (type === 'offer' && ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[UserRole.MEMBER]) {
    logger.info('AddOpportunityPage: User lacks permission for offers', { userRole, type });
    redirect(ROUTES.MEMBERSHIP(validLocale) + `?returnTo=${encodeURIComponent(ROUTES.ADD_OPPORTUNITY(validLocale) + (type ? `?type=${type}` : ''))}`);
  }

  logger.info('AddOpportunityPage: User authenticated', { userRole, type, hasToken: !!token });

  const t = await getTranslations('modules.opportunities')

  try {
    try {
      const { userMigrationService } = await import('@/features/auth/services/user-migration');
      const userExists = await userMigrationService.userDocumentExists(session.user.id);
      if (!userExists) {
        logger.warn('AddOpportunityPage: User document missing, initializing');
        await userMigrationService.ensureUserDocument(session.user as any);
        logger.info('AddOpportunityPage: User document created successfully');
      }
    } catch (migrationError) {
      logger.error('AddOpportunityPage: Failed to check/create user document:', migrationError);
    }

    // Render the page content
    return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": "Add Opportunity - Ring Platform",
            "description": description,
            "url": canonicalUrl,
            "mainEntity": {
              "@type": "WebPageElement",
              "name": "Opportunity Submission Form",
              "description": "Form for posting job opportunities, collaboration requests, and partnership opportunities"
            },
            "breadcrumb": {
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": "Home",
                  "item": baseUrl
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": "Opportunities",
                  "item": `${baseUrl}/opportunities`
                },
                {
                  "@type": "ListItem",
                  "position": 3,
                  "name": "Add Opportunity",
                  "item": canonicalUrl
                }
              ]
            },
            "potentialAction": {
              "@type": "CreateAction",
              "name": "Submit Opportunity",
              "description": "Create a new opportunity posting on the Ring platform"
            }
          })
        }}
      />

      <OpportunityFormWrapper locale={validLocale} opportunityType={type}>
        {/* Content Header - Opportunity Creation Style */}
        <div className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {t('createOpportunity')}
                </h1>
                <p className="text-muted-foreground">{t('opportunitiesDescription')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Opportunity Form */}
        <div className="flex-1 container mx-auto px-6 py-8 max-w-6xl">
          <Suspense fallback={
            <div className="flex justify-center items-center h-screen">
              <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
            </div>
          }>
            <AddOpportunityForm opportunityType={type} />
          </Suspense>
        </div>
      </OpportunityFormWrapper>
    </>
  );
  } catch (e) {
    logger.error('AddOpportunityPage: Unexpected error:', e);
    return (
      <>
        <title>Add Opportunity Error | Zemna AI</title>
        <meta name="robots" content="noindex, nofollow" />
        <div className="container mx-auto px-0 py-0">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Add Opportunity Error</h1>
            <p className="text-muted-foreground mb-4">An unexpected error occurred. Please try again later.</p>
            <a href={ROUTES.HOME(validLocale)} className="text-primary hover:underline">Return to Home</a>
          </div>
        </div>
      </>
    );
  }
}

/* 
 * OBSOLETE FUNCTIONS (removed with React 19 migration):
 * - generateMetadata() function (replaced by React 19 native document metadata)
 * 
 * React 19 Native Features Used:
 * - Document metadata: <title>, <meta>, <link> tags automatically hoisted to <head>
 * - Role-based access control: Authentication and permission checks preserved
 * - Form page SEO: Proper noindex/nofollow for protected form pages
 * - Breadcrumb structured data: Navigation context for form pages
 * - CreateAction schema: Structured data for form submission functionality
 * - Error handling: Preserved user permission validation and error display
 * - Preserved all form functionality and role-based authentication flow
 */