import { Suspense } from 'react'
import { cookies, headers } from 'next/headers'
import AddEntityForm from '@/features/entities/components/add-entity'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { PageProps } from '@/types/next-page'
import { resolvePageProps } from '@/utils/page-props'

// Force dynamic rendering for this page to ensure fresh data on every request
export const dynamic = 'force-dynamic'

// Define the type for the route params (if any)
type AddEntityParams = { id?: string };

/**
 * Renders the Add Entity page.
 * 
 * User steps:
 * 1. User navigates to the Add Entity page.
 * 2. The page checks user authentication.
 * 3. If authenticated, the page renders the Add Entity form.
 * 4. If not authenticated, the user is redirected to the login page.
 * 
 * @param props - The page properties including params and searchParams as Promises.
 * @returns JSX.Element - The rendered page content.
 */
export default async function AddEntityPage(props: PageProps<AddEntityParams>) {
  console.log('AddEntityPage: Starting');

  // Resolve params and searchParams using our utility function
  const { params, searchParams } = await resolvePageProps<AddEntityParams>(props);

  console.log('Params:', params);
  console.log('Search Params:', searchParams);

  // Get cookies and headers
  const cookieStore = await cookies()
  const headersList = await headers()
  const token = cookieStore.get("token");
  const userAgent = headersList.get('user-agent')

  console.log('AddEntityPage: Request details', {
    params,
    searchParams,
    userAgent,
    hasToken: !!token
  });

  // Authenticate user session
  console.log('AddEntityPage: Authenticating session');
  const session = await auth();
  console.log('AddEntityPage: Session authenticated', { 
    sessionExists: !!session, 
    userId: session?.user?.id, 
    role: session?.user?.role,
  });

  // Check user authentication
  if (!session) {
    console.log('AddEntityPage: Unauthorized access, redirecting to login');
    redirect(`${ROUTES.LOGIN}?callbackUrl=${ROUTES.ADD_ENTITY}`)
  }

  console.log('AddEntityPage: Rendering Add Entity form');

  // React 19 metadata for form pages
  const title = 'Add Entity - Ring App';
  const description = 'Add a new entity to the Ring App directory. Contribute to the growing ecosystem of technology companies and organizations.';
  const canonicalUrl = 'https://ring.ck.ua/entities/add';

  // Render the page content
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
      
      {/* Form-specific structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": "Add Entity - Ring Platform",
            "description": description,
            "url": canonicalUrl,
            "mainEntity": {
              "@type": "WebPageElement",
              "name": "Entity Submission Form",
              "description": "Form for adding new entities to the Ring platform directory"
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
                  "name": "Entities",
                  "item": "https://ring.ck.ua/entities"
                },
                {
                  "@type": "ListItem",
                  "position": 3,
                  "name": "Add Entity",
                  "item": canonicalUrl
                }
              ]
            }
          })
        }}
      />

      <Suspense fallback={
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
        </div>
      }>
        <AddEntityForm />
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
 * - Form page SEO: Proper noindex/nofollow for protected form pages
 * - Breadcrumb structured data: Navigation context for form pages
 * - WebPage schema: Structured data for form functionality
 * - Authentication protection: Redirects maintained for unauthorized access
 * - Preserved all form functionality and user authentication flow
 */