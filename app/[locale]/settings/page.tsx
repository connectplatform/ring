import { Suspense } from 'react'
import { cookies, headers } from 'next/headers'
import SettingsWrapper from '@/components/settings-wrapper'
import { auth } from '@/auth'
import { UserSettings } from '@/features/auth/types'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { LocalePageProps } from '@/utils/page-props'
import { loadTranslations, isValidLocale, generateHreflangAlternates, Locale, defaultLocale } from '@/utils/i18n-server'

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

  // React 19 metadata preparation
  const translations = loadTranslations(locale);
  const title = (translations as any).metadata?.settings || 'User Settings | Ring';
  const description = (translations as any).metaDescription?.settings || 'Manage your Ring account settings, preferences, and privacy options.';
  const canonicalUrl = `https://ring.ck.ua/${locale}/settings`;
  const alternates = generateHreflangAlternates('/settings');

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

    // Fetch settings from the API
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/settings`, {
      headers: {
        Cookie: cookies().toString(),
      },
    })

    if (response.ok) {
      initialSettings = await response.json()
      console.log('SettingsPage: User settings fetched', { hasSettings: !!initialSettings });
    } else {
      throw new Error('Failed to fetch settings')
    }

  } catch (e) {
    console.error("SettingsPage: Error fetching user settings:", e)
    error = "Failed to load user settings. Please try again later."
  }

  console.log('SettingsPage: Rendering', { hasError: !!error, hasSettings: !!initialSettings, locale });

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
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      
      {/* Security meta tags for user settings */}
      <meta name="robots" content="noindex, nofollow" />
      <meta name="googlebot" content="noindex, nofollow" />
      
      {/* Hreflang alternates */}
      {Object.entries(alternates).map(([lang, url]) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={url} />
      ))}

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