import type { Metadata } from 'next'
import { Suspense } from 'react'
import { headers } from 'next/headers'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { LocalePageProps } from '@/utils/page-props'
import { setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import StoreWrapper from '@/components/wrappers/store-wrapper'
import StoreSettingsClient from './store-settings-client'
import { connection } from 'next/server'
import { logger } from '@/lib/logger'
import { buildLocalizedMetadata, RING_PLATFORM_SEO } from '@/lib/seo-metadata'

type StoreSettingsParams = Record<string, never>

const storeSettingsRobots: Metadata['robots'] = { index: false, follow: false }

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
    path: 'store.settings',
    pathname: '/store/settings',
    siteName: RING_PLATFORM_SEO.siteName,
    twitterSite: RING_PLATFORM_SEO.twitterSite,
    robots: storeSettingsRobots,
  })
}

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
  await connection() // Next.js 16: opt out of prerendering

  logger.info('StoreSettingsPage: Starting');

  const params = await props.params;
  const searchParams = await props.searchParams;
  const validLocale: Locale = routing.locales.includes(params.locale as Locale) ? (params.locale as Locale) : (routing.defaultLocale as Locale);

  const headersList = await headers();
  logger.info('StoreSettingsPage: Request details', {
    params,
    searchParams,
    validLocale,
    userAgent: headersList.get('user-agent'),
  });

  try {
    logger.info('StoreSettingsPage: Authenticating session');
    const session = await auth();
    logger.info('StoreSettingsPage: Session authenticated', { sessionExists: !!session, userId: session?.user?.id });

    if (!session) {
      logger.info('StoreSettingsPage: No session, redirecting to localized login');
      redirect(ROUTES.LOGIN(validLocale));
    }

    try {
      const { userMigrationService } = await import('@/features/auth/services/user-migration');
      const userExists = await userMigrationService.userDocumentExists(session.user.id);
      if (!userExists) {
        logger.warn('StoreSettingsPage: User document missing, initializing');
        await userMigrationService.ensureUserDocument(session.user as any);
        logger.info('StoreSettingsPage: User document created successfully');
      }
    } catch (migrationError) {
      logger.error('StoreSettingsPage: Failed to check/create user document:', migrationError);
    }

    logger.info('StoreSettingsPage: Rendering store settings client');

    return (
      <StoreWrapper locale={validLocale}>
        <Suspense
          fallback={
            <div className="container mx-auto px-0 py-0">
              <div className="animate-pulse space-y-6">
                <div className="h-8 bg-muted rounded w-1/3" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="h-64 bg-muted rounded" />
                  <div className="h-64 bg-muted rounded" />
                </div>
              </div>
            </div>
          }
        >
          <StoreSettingsClient locale={validLocale} searchParams={searchParams} />
        </Suspense>
      </StoreWrapper>
    )

  } catch (e) {
    logger.error('StoreSettingsPage: Error:', e);
    
    return (
      <div className="container mx-auto px-0 py-0">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Store Settings Error</h1>
          <p className="text-muted-foreground mb-4">
            Failed to load store settings. Please try again later.
          </p>
          <a href={ROUTES.STORE(validLocale)} className="text-primary hover:underline">
            Return to Store
          </a>
        </div>
      </div>
    )
  }
}
