import { Suspense } from 'react'
import { headers } from 'next/headers'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { LocalePageProps } from '@/utils/page-props'
import { loadTranslations, isValidLocale, type Locale, defaultLocale } from '@/i18n-config'
import StoreSettingsClient from './store-settings-client'

export const dynamic = 'force-dynamic'

// Define the type for the store settings route params
type StoreSettingsParams = {};

/**
 * StoreSettingsPage component
 * Renders the store settings page for managing addresses, payment methods, and store preferences
 * 
 * User steps:
 * 1. User navigates to the store settings page (e.g., /en/store/settings)
 * 2. The page extracts the locale from URL params
 * 3. The page checks for user authentication
 * 4. If not authenticated, user is redirected to localized login
 * 5. If authenticated, the store settings client component is rendered
 * 6. User can manage addresses, payment methods, and store preferences
 * 
 * @param props - The LocalePageProps with params and searchParams as Promises
 * @returns The rendered StoreSettingsPage component
 */
export default async function StoreSettingsPage(props: LocalePageProps<StoreSettingsParams>) {
  console.log('StoreSettingsPage: Starting');

  // Resolve params and searchParams
  const params = await props.params;
  const searchParams = await props.searchParams;

  // Extract and validate locale
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale;
  console.log('StoreSettingsPage: Using locale', locale);

  // Basic metadata for authenticated page
  const translations = await loadTranslations(locale);
  const title = `Store Settings | Ring Platform`;
  const description = 'Manage your store preferences, shipping addresses, and payment methods on Ring platform.';
  const canonicalUrl = `${process.env.NEXT_PUBLIC_API_URL || "https://ring.platform"}/${locale}/store/settings`;

  const headersList = await headers()

  console.log('StoreSettingsPage: Request details', {
    params,
    searchParams,
    locale,
    userAgent: headersList.get('user-agent'),
  });

  try {
    console.log('StoreSettingsPage: Authenticating session');
    const session = await auth()
    console.log('StoreSettingsPage: Session authenticated', { sessionExists: !!session, userId: session?.user?.id });

    if (!session) {
      console.log('StoreSettingsPage: No session, redirecting to localized login');
      redirect(ROUTES.LOGIN(locale))
    }

    console.log('StoreSettingsPage: Rendering store settings client');

    return (
      <>
        {/* React 19 Native Document Metadata - Authenticated Page */}
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalUrl} />
        
        {/* Authenticated page security meta tags */}
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <Suspense fallback={
          <div className="container mx-auto px-4 py-8">
            <div className="animate-pulse space-y-6">
              <div className="h-8 bg-muted rounded w-1/3"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="h-64 bg-muted rounded"></div>
                <div className="h-64 bg-muted rounded"></div>
              </div>
            </div>
          </div>
        }>
          <StoreSettingsClient 
            locale={locale}
            searchParams={searchParams}
          />
        </Suspense>
      </>
    )

  } catch (e) {
    console.error("StoreSettingsPage: Error:", e)
    
    return (
      <>
        <title>Store Settings Error | Ring Platform</title>
        <meta name="robots" content="noindex, nofollow" />
        
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Store Settings Error</h1>
            <p className="text-muted-foreground mb-4">
              Failed to load store settings. Please try again later.
            </p>
            <a 
              href={ROUTES.STORE(locale)} 
              className="text-primary hover:underline"
            >
              Return to Store
            </a>
          </div>
        </div>
      </>
    )
  }
}

/* 
 * React 19 Native Features Used:
 * - Document metadata: <title>, <meta>, <link> tags automatically hoisted to <head>
 * - Automatic meta tag deduplication and precedence handling
 * - Security meta tags for authenticated store settings pages (noindex, nofollow)
 * - Suspense for progressive loading of store settings data
 * - Preserved all authentication and locale logic
 */
