import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata, RING_PLATFORM_SEO } from '@/lib/seo-metadata'
import { Suspense } from 'react'
import { headers } from 'next/headers'
import SettingsWrapper from '@/components/wrappers/settings-wrapper'
import SettingsContent from '@/features/auth/components/settings-content'
import { updateSettings } from '@/app/_actions/settings'
import { auth } from '@/auth'
import { UserSettings } from '@/features/auth/types'
import { ROUTES } from '@/constants/routes'
import { LocalePageProps } from '@/utils/page-props'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { getTranslations } from 'next-intl/server'
import { connection } from 'next/server'
import { logger } from '@/lib/logger'
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
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'settings',
    pathname: '/settings',
    siteName: RING_PLATFORM_SEO.siteName,
    twitterSite: RING_PLATFORM_SEO.twitterSite,
    robots: { index: false, follow: false },
  })
}
export default async function SettingsPage(props: LocalePageProps<SettingsParams>) {
  await connection() // Next.js 16: opt out of prerendering

  logger.info('SettingsPage: Starting');

  const params = await props.params;
  const searchParams = await props.searchParams;
  const validLocale: Locale = routing.locales.includes(params.locale as Locale) ? (params.locale as Locale) : (routing.defaultLocale as Locale);

  const headersList = await headers();
  logger.info('SettingsPage: Request details', {
    params,
    searchParams,
    locale: validLocale,
    userAgent: headersList.get('user-agent'),
  });

  const session = await auth();
  logger.info('SettingsPage: Session authenticated', { sessionExists: !!session, userId: session?.user?.id });
  if (!session) return null // Layout AuthGuard already redirects; this narrowing satisfies TypeScript

  try {
    const { userMigrationService } = await import('@/features/auth/services/user-migration');
    const userExists = await userMigrationService.userDocumentExists(session.user.id);
    if (!userExists) {
      logger.warn('SettingsPage: User document missing, initializing');
      await userMigrationService.ensureUserDocument(session.user as any);
    }
  } catch (migrationError) {
    logger.error('SettingsPage: Failed to check/create user document:', migrationError);
  }

  const translations = await getTranslations('settings');
  const title = `${(translations as any).settings?.title || 'Settings'} | Zemna AI`;
  const description = (translations as any).settings?.description || 'Manage your Ring account settings, preferences, and privacy options.';
  const canonicalUrl = `${process.env.NEXT_PUBLIC_API_URL || "https://zemna.ai"}${ROUTES.SETTINGS(validLocale)}`;

  let initialSettings: UserSettings | null = null;
  let error: string | null = null;

  try {
    const { getUserSettings } = await import('@/features/auth/services/get-user-settings');
    initialSettings = await getUserSettings();
    logger.info('SettingsPage: User settings fetched', { hasSettings: !!initialSettings });
  } catch (e) {
    logger.error('SettingsPage: Error fetching user settings:', e);
    error = 'Failed to load user settings. Please try again later.';
  }

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      <meta name="robots" content="noindex, nofollow" />
      <meta name="googlebot" content="noindex, nofollow" />
      <SettingsWrapper locale={validLocale}>
        <SettingsContent
          initialSettings={initialSettings}
          initialError={error}
          searchParams={searchParams as { [key: string]: string | string[] | undefined }}
          updateSettingsAction={updateSettings}
          locale={validLocale}
        />
      </SettingsWrapper>
    </>
  );
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