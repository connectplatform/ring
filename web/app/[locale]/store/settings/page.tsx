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
import { buildLocalizedMetadata } from '@/lib/seo-metadata'

type StoreSettingsParams = Record<string, never>

// Disables SEO indexing for the store settings page for privacy/security.
const storeSettingsRobots: Metadata['robots'] = { index: false, follow: false }

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  // Extract the locale param (async).
  const { locale: localeParam } = await params

  // Validate locale or fallback to default locale.
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  // Set current request locale for i18n.
  setRequestLocale(locale)

  // Generate localized metadata for SEO/settings.
  return buildLocalizedMetadata({
    locale,
    path: 'store.settings',
    pathname: '/store/settings',
    robots: storeSettingsRobots,
  })
}

/**
 * StoreSettingsPage component
 * Handles authentication, user migration, and renders the settings page.
 */
export default async function StoreSettingsPage(
  props: LocalePageProps<StoreSettingsParams>
) {
  // Opt out of static prerendering for this page in Next.js 16.
  await connection() // TODO: When stable, consider using Next.js "dynamic = 'force-dynamic'" export for clarity.

  logger.info('StoreSettingsPage: Starting')

  // Await params and searchParams Promises.
  const params = await props.params
  const searchParams = await props.searchParams

  // Determine valid locale: use from params if valid, otherwise default.
  const validLocale: Locale = routing.locales.includes(params.locale as Locale)
    ? (params.locale as Locale)
    : (routing.defaultLocale as Locale)

  // Get HTTP headers for request context/debugging.
  const headersList = await headers()
  logger.info('StoreSettingsPage: Request details', {
    params,
    searchParams,
    validLocale,
    userAgent: headersList.get('user-agent'),
  })

  try {
    // Step 1: Ensure user is authenticated, else redirect to login.
    logger.info('StoreSettingsPage: Authenticating session')
    const session = await auth()
    logger.info('StoreSettingsPage: Session authenticated', { sessionExists: !!session, userId: session?.user?.id })

    if (!session) {
      logger.info('StoreSettingsPage: No session, redirecting to localized login')
      redirect(ROUTES.LOGIN(validLocale))
      // Note: redirect() ends execution.
    }

    // Step 2: Optionally ensure the user's DB document exists (idempotent).
    try {
      const { userMigrationService } = await import('@/features/auth/services/user-migration')
      const userExists = await userMigrationService.userDocumentExists(session.user.id)
      if (!userExists) {
        logger.warn('StoreSettingsPage: User document missing, initializing')
        await userMigrationService.ensureUserDocument(session.user as any)
        logger.info('StoreSettingsPage: User document created successfully')
      }
    } catch (migrationError) {
      // User migration step failed but does not block page render.
      logger.error('StoreSettingsPage: Failed to check/create user document:', migrationError)
    }

    logger.info('StoreSettingsPage: Rendering store settings client')

    // Step 3: Render the actual settings page in a wrapper with a Suspense skeleton.
    // TODO: With React19, consider replacing fallback skeleton with React's new built-in <Suspense /> features when app architecture permits.
    return (
      <StoreWrapper locale={validLocale}>
        <Suspense
          fallback={
            // Skeleton loading UI for settings page.
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
    // Top-level error: session, logic, or dynamic import errors handled here.
    logger.error('StoreSettingsPage: Error:', e)

    // TODO: Consider using Next.js error.js for global error boundaries instead of inline error UI.
    return (
      <div className="container mx-auto px-0 py-0">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Store Settings Error
          </h1>
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
