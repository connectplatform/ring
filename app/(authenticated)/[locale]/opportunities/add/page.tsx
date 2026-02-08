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
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates, type Locale } from '@/i18n-config'

export const dynamic = 'force-dynamic'

// Role hierarchy for access control
const ROLE_HIERARCHY = {
  [UserRole.VISITOR]: 0,
  [UserRole.SUBSCRIBER]: 1,
  [UserRole.MEMBER]: 2,
  [UserRole.CONFIDENTIAL]: 3,
  [UserRole.ADMIN]: 4,
} as const

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
  let error: string | null = null
  
  console.log('AddOpportunityPage: Starting');

  // Step 1: Resolve params and searchParams using our utility function
  const { params, searchParams } = await resolvePageProps(props);
  
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale;
  const type = searchParams.type as 'request' | 'offer' | 'cv' | undefined

  // Load translations for this locale
  const translations = await loadTranslations(locale);
  const alternates = generateHreflangAlternates('/opportunities/add');

  console.log('Params:', params);
  console.log('Search Params:', searchParams);
  console.log('Opportunity Type:', type);
  console.log('Locale:', locale);

  // Step 2: Retrieve cookies and headers
  const cookieStore = await cookies()
  const headersList = await headers()
  const token = cookieStore.get("token");
  const userAgent = headersList.get('user-agent')

  // React 19 metadata for form pages - dynamically generated based on type
  const title = type === 'request'
    ? 'Create Request | Ring App'
    : type === 'offer'
    ? 'Create Offer | Ring App'
    : type === 'cv'
    ? 'Share Developer CV | Ring App'
    : 'Add Opportunity | Ring App';
  const description = type === 'request'
    ? 'Create a request to find services, advice, or collaboration from the Ring community.'
    : type === 'offer'
    ? 'Post an official opportunity from your organization on the Ring platform.'
    : type === 'cv'
    ? 'Share your developer profile and skills to connect with Ring platform opportunities.'
    : 'Add a new opportunity to the Ring App. Share job postings, collaboration requests, and partnership opportunities with the community.';
  const canonicalUrl = `https://ring.ck.ua/${locale}/opportunities/add${type ? `?type=${type}` : ''}`;

  try {
    // Step 3: Authenticate user
    console.log('AddOpportunityPage: Authenticating user');
    const session = await auth()
    
    if (!session) {
      console.log('AddOpportunityPage: No session, redirecting to login');
      const returnTo = `/${locale}/opportunities/add${type ? `?type=${type}` : ''}`
      redirect(`${ROUTES.LOGIN(locale)}?returnTo=${encodeURIComponent(returnTo)}`)
    }

    // Step 4: Check user role and permissions
    const userRole = session.user?.role as UserRole

    // Basic permission check - must be at least SUBSCRIBER
    if (!userRole || ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[UserRole.SUBSCRIBER]) {
      console.log('AddOpportunityPage: User lacks basic permission', { userRole });
      redirect(`/${locale}/auth/register?returnTo=${encodeURIComponent(`/${locale}/opportunities/add${type ? `?type=${type}` : ''}`)}`)
    }

    // Type-specific permission checks
    if (type === 'offer' && ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[UserRole.MEMBER]) {
      console.log('AddOpportunityPage: User lacks permission for offers', { userRole, type });
      redirect(`/${locale}/membership?returnTo=${encodeURIComponent(`/${locale}/opportunities/add?type=${type}`)}`)
    }

    // Step 5: Log authentication and request details
    console.log('AddOpportunityPage: User authenticated', {
      userRole,
      type,
      params,
      searchParams,
      userAgent,
      hasToken: !!token
    });

  } catch (e) {
    // Step 6: Handle unexpected errors
    console.error("AddOpportunityPage: Unexpected error:", e)
    error = "An unexpected error occurred. Please try again later."
  }

  // Step 7: Render the page content
  return (
    <>
      {/* React 19 Native Document Metadata - Form Page */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Hreflang alternates */}
      {Object.entries(alternates).map(([lang, url]) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={url as string} />
      ))}

      {/* OpenGraph metadata */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content="en_US" />
      <meta property="og:alternate_locale" content="uk_UA" />
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      
      {/* Form page specific meta tags */}
      <meta name="robots" content="noindex, nofollow" />
      <meta name="googlebot" content="noindex, nofollow" />
      
      {/* Opportunity form structured data */}
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
                  "item": "https://ring.ck.ua"
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": "Opportunities",
                  "item": "https://ring.ck.ua/opportunities"
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

      <OpportunityFormWrapper
        locale={locale}
        opportunityType={type}
      >
        <Suspense fallback={
          <div className="flex justify-center items-center h-screen">
            <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
          </div>
        }>
          {error ? (
            <div className="text-center text-red-600 p-4">{error}</div>
          ) : (
            <AddOpportunityForm opportunityType={type} locale={locale} />
          )}
        </Suspense>
      </OpportunityFormWrapper>
    </>
  )
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