import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { getTranslations } from 'next-intl/server'
import dynamicImport from 'next/dynamic'
import { logger } from '@/lib/logger'
import { type AdminOrdersSearchParams } from '@/features/store/types'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import { connection } from 'next/server'
import StoreHubTabs from '@/components/admin/store-hub-tabs'

const AdminOrdersClient = dynamicImport(() => import('./admin-orders-client'), {
  loading: () => (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
    </div>
  )
})

// Force dynamic rendering for this page to ensure fresh data on every request

/**
 * Fetches all orders for admin with optional filtering
 */
async function getAdminOrders(statusFilter?: string) {
  try {
    logger.info('AdminOrders: Fetching orders with filter', { statusFilter });
    
    const options = statusFilter ? { 
      statusFilter: statusFilter as 'new' | 'paid' | 'processing' | 'shipped' | 'completed' | 'canceled'
    } : undefined;
    
    const result = await StoreOrdersService.adminListAllOrders(options);
    logger.info('AdminOrders: Orders fetched successfully', { count: result.items.length });
    
    return result;
  } catch (error) {
    logger.error('AdminOrders: Error fetching orders:', error);
    return { items: [], lastVisible: null };
  }
}


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
    path: 'store.orders.list',
    pathname: '/admin/store/orders',
    robots: { index: false, follow: false },
  })
}

export default async function AdminOrdersPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ locale: string }>;
  searchParams: Promise<AdminOrdersSearchParams>;
}) {
  await connection() // Next.js 16: opt out of prerendering

  logger.info('AdminOrdersPage: Starting');

  // Resolve params and searchParams
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  // Extract and validate locale
  const validLocale: Locale = routing.locales.includes(resolvedParams.locale as Locale) ? (resolvedParams.locale as Locale) : (routing.defaultLocale as Locale);
  logger.info('AdminOrdersPage: Using locale', { locale: validLocale });
  const t = await getTranslations('modules.admin');
  const adminLabels = buildModulesAdminLabels(t);

  // Step 1: Authenticate and check admin role
  const session = await auth();

  if (!session?.user) {
    redirect(ROUTES.LOGIN(validLocale));
  }

  if (!isPlatformAdmin(session.user.role)) {
    logger.info('AdminOrdersPage: Non-admin user, redirecting to unauthorized');
    redirect(ROUTES.UNAUTHORIZED(validLocale));
  }

  // Step 2: Get status filter from search params
  const statusFilter = resolvedSearchParams.status;
  logger.info('AdminOrdersPage: Request details', { 
    locale: validLocale, 
    statusFilter,
    searchParams: resolvedSearchParams 
  });

  // Step 3: Fetch orders
  const { items: orders } = await getAdminOrders(statusFilter);

  logger.info('AdminOrdersPage: Rendering', { 
    orderCount: orders.length, 
    statusFilter,
    locale: validLocale 
  });

  const tabLabels = {
    orders: t('storeHub.orders'),
    stock: t('storeHub.stock'),
    commissions: t('storeHub.commissions'),
  }

  const ordersLabels = {
    title: t('storeHub.ordersPage.title'),
    allStatuses: t('storeHub.ordersPage.allStatuses'),
    refresh: t('storeHub.ordersPage.refresh'),
    refreshing: t('storeHub.ordersPage.refreshing'),
    errorPrefix: t('storeHub.ordersPage.errorPrefix'),
    updateStatusError: t('storeHub.ordersPage.updateStatusError'),
    noOrders: t('storeHub.ordersPage.noOrders'),
    orderNumber: t('storeHub.ordersPage.orderNumber'),
    statusLabel: t('storeHub.ordersPage.statusLabel'),
    userLabel: t('storeHub.ordersPage.userLabel'),
    createdLabel: t('storeHub.ordersPage.createdLabel'),
    itemsLabel: t('storeHub.ordersPage.itemsLabel'),
    update: t('storeHub.ordersPage.update'),
    updating: t('storeHub.ordersPage.updating'),
    statusLabels: {
      new: t('storeHub.ordersPage.statuses.new'),
      paid: t('storeHub.ordersPage.statuses.paid'),
      processing: t('storeHub.ordersPage.statuses.processing'),
      shipped: t('storeHub.ordersPage.statuses.shipped'),
      completed: t('storeHub.ordersPage.statuses.completed'),
      canceled: t('storeHub.ordersPage.statuses.canceled'),
    },
  }

  return (
    <AdminWrapper locale={validLocale} pageContext="store" labels={adminLabels}>
      <StoreHubTabs locale={validLocale} active="orders" labels={tabLabels} />
      <Suspense fallback={
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
        </div>
      }>
        <AdminOrdersClient
          initialOrders={orders}
          currentStatusFilter={statusFilter}
          locale={validLocale}
          labels={ordersLabels}
        />
      </Suspense>
    </AdminWrapper>
  );
}


