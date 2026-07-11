/**
 * Vendor Dashboard - Main hub for vendor management
 * 
 * Displays key metrics, recent orders, and DAGI agent activation
 */

import type { Metadata } from 'next'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { headers } from 'next/headers'
import { auth } from '@/auth'
import { ROUTES } from '@/constants/routes'
import VendorDashboardWrapper from '@/components/wrappers/vendor-dashboard-wrapper'
import { DAGIActivationCard } from '@/components/vendor/dagi-activation-card'
import { VendorDashboard } from '@/components/vendor/vendor-dashboard'
import { RecentOrders } from '@/components/vendor/recent-orders'
import { connection } from 'next/server'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { logger } from '@/lib/logger'
import { getVendorEntity } from '@/features/entities/services/vendor-entity'
import { getVendorProfile } from '@/features/store/services/vendor-profile'
import {
  getVendorDashboardStats,
  withVendorProfileDefaults,
} from '@/features/store/services/vendor-stats'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { listOwnedGateAssets } from '@/features/nft-gates/purchase'
import { listActiveStakes } from '@/features/nft-gates/gate-escrow'
import { hasFeature } from '@/features/nft-gates/gate-resolver'

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

    const vendorEntity = await getVendorEntity(session.user.id)
    if (!vendorEntity) {
      redirect(ROUTES.VENDOR_START(validLocale))
    }

    const [rawProfile, stats, ordersResult, ownedGates, gateStakes, dagiUnlocked] =
      await Promise.all([
        getVendorProfile(vendorEntity.id),
        getVendorDashboardStats(vendorEntity.id),
        StoreOrdersService.listOrdersForVendor(vendorEntity.id, { limit: 5 }),
        listOwnedGateAssets(session.user.id),
        listActiveStakes(session.user.id),
        hasFeature(session.user.id, 'vendor.dagi'),
      ])

    const vendor = withVendorProfileDefaults(rawProfile, vendorEntity.id, session.user.id)
    const t = await getTranslations({ locale: validLocale, namespace: 'vendor.dashboard' })

    const recentOrders = ordersResult.items.map((order: any) => {
      const vendorSettlement = Array.isArray(order.vendorSettlements)
        ? order.vendorSettlements.find(
            (s: any) => s.vendorId === vendorEntity.id || s.vendorEntityId === vendorEntity.id,
          )
        : undefined
      return {
        id: order.id,
        status: order.status,
        total: order.total,
        createdAt: order.createdAt,
        customer: order.shippingInfo?.email || order.checkoutInfo?.email || order.userId,
        netAmount: vendorSettlement?.netAmount,
      }
    })

    return (
    <VendorDashboardWrapper locale={validLocale}>
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('subtitle')}
          </p>
        </div>

        <VendorDashboard
          vendor={vendor}
          entity={vendorEntity}
          stats={stats}
          locale={validLocale}
          recentOrders={recentOrders}
        />

        <div className="grid gap-6 lg:grid-cols-2 mt-8 mb-8">
          <Suspense fallback={<div className="h-48 animate-pulse bg-muted rounded-lg" />}>
            <DAGIActivationCard
              userId={session.user.id}
              locale={validLocale}
              dagiUnlocked={dagiUnlocked}
              owned={ownedGates}
              stakes={gateStakes}
            />
          </Suspense>

          <Suspense fallback={<div className="h-48 animate-pulse bg-muted rounded-lg" />}>
            <RecentOrders orders={recentOrders} locale={validLocale} />
          </Suspense>
        </div>
      </div>
    </VendorDashboardWrapper>
  );
  } catch (e) {
    logger.error('VendorDashboardPage: Error:', e);
    return (
      <>
        <title>Vendor Dashboard Error | Ring Platform</title>
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
