import { Suspense } from 'react'
import { headers } from 'next/headers'
import SettingsWrapper from '@/components/wrappers/settings-wrapper'
import { auth } from '@/auth'
import { UserSettings } from '@/features/auth/types'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { LocalePageProps } from '@/utils/page-props'
import { loadTranslations, isValidLocale, generateHreflangAlternates, type Locale, defaultLocale } from '@/i18n-config'
export const dynamic = 'force-dynamic'

// Define the type for the settings route params
type SettingsParams = {};

/**
 * SettingsPage component
 * Renders the settings page, handling authentication and initial data fetching
 * Now with i18n support
 * 
 * User steps:
 * 1. User navigates to the settings page (e.g., /en/settings or /uk/settings)
 * 2. The page extracts the locale from URL params
 * 3. The page checks for user authentication
 * 4. If not authenticated, user is redirected to localized login
 * 5. If authenticated, the page fetches initial user settings from the API
 * 6. The settings-wrapper component is rendered with initial data and locale
 * 
 * @param props - The LocalePageProps with params and searchParams as Promises
 * @returns The rendered SettingsPage component
 */
export default async function SettingsPage(props: LocalePageProps<SettingsParams>) {
  console.log('SettingsPage: Starting');

  // Resolve params and searchParams
  const params = await props.params;
  const searchParams = await props.searchParams;

  // Extract and validate locale
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale;
  console.log('SettingsPage: Using locale', locale);

  // Basic metadata for authenticated page (no SEO needed)
  const translations = await loadTranslations(locale);
  const title = `${(translations as any).settings?.title || 'Settings'} | Ring Platform`;
  const description = (translations as any).settings?.description || 'Manage your Ring account settings, preferences, and privacy options.';
  const canonicalUrl = `${process.env.NEXT_PUBLIC_API_URL || "https://ring.platform"}/${locale}/settings`;

  let initialSettings: UserSettings | null = null
  let error: string | null = null

  const headersList = await headers()

  console.log('SettingsPage: Request details', {
    params,
    searchParams,
    locale,
    userAgent: headersList.get('user-agent'),
  });

  try {
    console.log('SettingsPage: Authenticating session');
    const session = await auth()
    console.log('SettingsPage: Session authenticated', { sessionExists: !!session, userId: session?.user?.id });

    if (!session) {
      console.log('SettingsPage: No session, redirecting to localized login');
      redirect(ROUTES.LOGIN(locale))
    }

    // Fetch settings using direct service call
    console.log('SettingsPage: Calling getUserSettings service');
    const { getUserSettings } = await import('@/features/auth/services/get-user-settings');
    initialSettings = await getUserSettings();
    console.log('SettingsPage: User settings fetched', { hasSettings: !!initialSettings });

  } catch (e) {
    console.error("SettingsPage: Error fetching user settings:", e)
    error = "Failed to load user settings. Please try again later."
  }

  console.log('SettingsPage: Rendering', { hasError: !!error, hasSettings: !!initialSettings, locale });

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

      <SettingsWrapper 
        initialSettings={initialSettings}
        initialError={error}
        locale={locale}
      />
    </>
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
 * - Security meta tags for user settings pages (noindex, nofollow)
 * - Preserved all authentication, settings fetching, and locale logic
 */