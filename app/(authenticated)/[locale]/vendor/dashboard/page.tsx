/**
 * Vendor Dashboard - Main hub for vendor management
 * 
 * Displays key metrics, recent orders, and DAGI agent activation
 */

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata, RING_PLATFORM_SEO } from '@/lib/seo-metadata'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { headers } from 'next/headers'
import { auth } from '@/auth'
import { ROUTES } from '@/constants/routes'
import VendorDashboardWrapper from '@/components/wrappers/vendor-dashboard-wrapper'
import { DAGIActivationCard } from '@/components/vendor/dagi-activation-card'
import { DashboardStats } from '@/components/vendor/dashboard-stats'
import { RecentOrders } from '@/components/vendor/recent-orders'
import { connection } from 'next/server'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { logger } from '@/lib/logger'

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
    path: 'vendor.dashboard',
    pathname: '/vendor/dashboard',
    siteName: RING_PLATFORM_SEO.siteName,
    twitterSite: RING_PLATFORM_SEO.twitterSite,
    robots: { index: false, follow: false },
  })
}
export default async function VendorDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection() // Next.js 16: opt out of prerendering

  logger.info('VendorDashboardPage: Starting');

  const { locale } = await params;
  const validLocale: Locale = routing.locales.includes(locale as Locale) ? (locale as Locale) : (routing.defaultLocale as Locale);

  const headersList = await headers();
  logger.info('VendorDashboardPage: Request details', { locale: validLocale, userAgent: headersList.get('user-agent') });

  try {
    logger.info('VendorDashboardPage: Authenticating session');
    const session = await auth();
    logger.info('VendorDashboardPage: Session authenticated', { sessionExists: !!session, userId: session?.user?.id });

    if (!session?.user?.id) {
      logger.info('VendorDashboardPage: No session, redirecting to login');
      redirect(ROUTES.LOGIN(validLocale));
    }

    try {
      const { userMigrationService } = await import('@/features/auth/services/user-migration');
      const userExists = await userMigrationService.userDocumentExists(session.user.id);
      if (!userExists) {
        logger.warn('VendorDashboardPage: User document missing, initializing');
        await userMigrationService.ensureUserDocument(session.user as any);
        logger.info('VendorDashboardPage: User document created successfully');
      }
    } catch (migrationError) {
      logger.error('VendorDashboardPage: Failed to check/create user document:', migrationError);
    }

    return (
    <VendorDashboardWrapper locale={validLocale}>
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Vendor Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Manage your farm operations and AI agent
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          <Suspense fallback={<div className="h-32 animate-pulse bg-muted rounded-lg" />}>
            <DashboardStats />
          </Suspense>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          <Suspense fallback={<div className="h-96 animate-pulse bg-muted rounded-lg" />}>
            <DAGIActivationCard userId={session.user.id} />
          </Suspense>

          <Suspense fallback={<div className="h-96 animate-pulse bg-muted rounded-lg" />}>
            <RecentOrders />
          </Suspense>
        </div>
      </div>
    </VendorDashboardWrapper>
  );
  } catch (e) {
    logger.error('VendorDashboardPage: Error:', e);
    return (
      <>
        <title>Vendor Dashboard Error | Zemna AI</title>
        <meta name="robots" content="noindex, nofollow" />
        <div className="container mx-auto px-0 py-0">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Vendor Dashboard Error</h1>
            <p className="text-muted-foreground mb-4">Failed to load vendor dashboard. Please try again later.</p>
            <a href={ROUTES.HOME(validLocale)} className="text-primary hover:underline">Return to Home</a>
          </div>
        </div>
      </>
    );
  }
}
