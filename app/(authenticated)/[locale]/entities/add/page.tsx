import { Suspense } from 'react'
import { cookies, headers } from 'next/headers'
import AddEntityForm from '@/features/entities/components/add-entity'
import EntityFormWrapper from '@/components/wrappers/entity-form-wrapper'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { resolvePageProps, LocalePageProps } from '@/utils/page-props'
import { isValidLocale, defaultLocale, loadTranslations, generateHreflangAlternates, type Locale } from '@/i18n-config'

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
export default async function AddEntityPage(props: LocalePageProps<AddEntityParams>) {
  console.log('AddEntityPage: Starting');

  // Resolve params and searchParams using our utility function
  const { params, searchParams } = await resolvePageProps<AddEntityParams>(props);

  // i18n: Extract and validate locale
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale;

  // i18n: Load translations for this locale
  const translations = await loadTranslations(locale);

  // i18n: Generate hreflang alternates for SEO
  const alternates = generateHreflangAlternates('/entities/add');

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

  // i18n: Use translated title/description if available, fallback to English
  const title = (translations as any)?.metadata?.addEntity || 'Add Entity - Ring App';
  const description = (translations as any)?.metaDescription?.addEntity || 'Add a new entity to the Ring App directory. Contribute to the growing ecosystem of technology companies and organizations.';
  const canonicalUrl = `${process.env.NEXT_PUBLIC_API_URL || "https://ring.ck.ua"}${locale}/entities/add`;

  // Render the page content
  return (
    <>
      {/* React 19 Native Document Metadata - Form Page */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Hreflang alternates for i18n SEO */}
      {Object.entries(alternates).map(([lang, url]) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={url as string} />
      ))}

      {/* OpenGraph metadata */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content={locale === 'uk' ? 'uk_UA' : 'en_US'} />
      <meta property="og:alternate_locale" content={locale === 'uk' ? 'en_US' : 'uk_UA'} />

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
            "name": title,
            "description": description,
            "url": canonicalUrl,
            "mainEntity": {
              "@type": "WebPageElement",
              "name": (translations as any)?.formTitle?.addEntity || "Entity Submission Form",
              "description": (translations as any)?.formDescription?.addEntity || "Form for adding new entities to the Ring platform directory"
            },
            "breadcrumb": {
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": (translations as any)?.breadcrumb?.home || "Home",
                  "item": process.env.NEXT_PUBLIC_API_URL || "https://ring.ck.ua"
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": (translations as any)?.breadcrumb?.entities || "Entities",
                  "item": `${process.env.NEXT_PUBLIC_API_URL || "https://ring.ck.ua"}${locale}/entities`
                },
                {
                  "@type": "ListItem",
                  "position": 3,
                  "name": (translations as any)?.breadcrumb?.addEntity || "Add Entity",
                  "item": canonicalUrl
                }
              ]
            }
          })
        }}
      />

      <EntityFormWrapper locale={locale}>
        <Suspense fallback={
          <div className="flex justify-center items-center h-screen">
            <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
          </div>
        }>
          <AddEntityForm locale={locale} translations={translations} />
        </Suspense>
      </EntityFormWrapper>
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