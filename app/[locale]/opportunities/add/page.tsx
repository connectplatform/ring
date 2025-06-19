import React, { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import AddOpportunityForm from '@/features/opportunities/components/add-opportunity'
import { auth } from '@/auth'
import { ROUTES } from '@/constants/routes'
import { UserRole } from '@/features/auth/types'
import { PageProps } from '@/types/next-page'
import { resolvePageProps } from '@/utils/page-props'

export const dynamic = 'force-dynamic'

/**
 * AddOpportunityPage component for adding new opportunities.
 * This component handles user authentication, permission checks, and renders the add opportunity form.
 * 
 * @param props - The page properties including params and searchParams.
 * 
 * User flow:
 * 1. User navigates to the add opportunity page
 * 2. System checks for user authentication
 * 3. If not authenticated, user is redirected to login page
 * 4. If authenticated, system checks user permissions
 * 5. If user has permission, the add opportunity form is displayed
 * 6. If user doesn't have permission, an error message is shown
 */
export default async function AddOpportunityPage(props: PageProps) {
  let error: string | null = null
  
  console.log('AddOpportunityPage: Starting');

  // Step 1: Resolve params and searchParams using our utility function
  const { params, searchParams } = await resolvePageProps(props);

  console.log('Params:', params);
  console.log('Search Params:', searchParams);

  // Step 2: Retrieve cookies and headers
  const cookieStore = await cookies()
  const headersList = await headers()
  const token = cookieStore.get("token");
  const userAgent = headersList.get('user-agent')

  // React 19 metadata for form pages
  const title = 'Add Opportunity | Ring App';
  const description = 'Add a new opportunity to the Ring App. Share job postings, collaboration requests, and partnership opportunities with the community.';
  const canonicalUrl = 'https://ring.ck.ua/opportunities/add';

  try {
    // Step 3: Authenticate user
    console.log('AddOpportunityPage: Authenticating user');
    const session = await auth()
    
    if (!session) {
      console.log('AddOpportunityPage: No session, redirecting to login');
      redirect(`${ROUTES.LOGIN}?callbackUrl=${ROUTES.ADD_OPPORTUNITY}`)
    }

    // Step 4: Check user role and permissions
    const userRole = session.user?.role as UserRole

    if (![UserRole.MEMBER, UserRole.CONFIDENTIAL, UserRole.ADMIN].includes(userRole)) {
      console.log('AddOpportunityPage: User lacks permission', { userRole });
      error = "You don't have permission to add opportunities."
    }

    // Step 5: Log authentication and request details
    console.log('AddOpportunityPage: User authenticated', {
      userRole,
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

      <Suspense fallback={
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
        </div>
      }>
        {error ? (
          <div className="text-center text-red-600 p-4">{error}</div>
        ) : (
          <AddOpportunityForm />
        )}
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
 * - Role-based access control: Authentication and permission checks preserved
 * - Form page SEO: Proper noindex/nofollow for protected form pages
 * - Breadcrumb structured data: Navigation context for form pages
 * - CreateAction schema: Structured data for form submission functionality
 * - Error handling: Preserved user permission validation and error display
 * - Preserved all form functionality and role-based authentication flow
 */