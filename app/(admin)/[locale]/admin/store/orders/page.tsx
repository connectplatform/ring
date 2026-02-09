import React, { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { UserRole } from '@/features/auth/types'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { ROUTES } from '@/constants/routes'
import { isValidLocale, defaultLocale } from '@/i18n-config'
import dynamicImport from 'next/dynamic'
import { logger } from '@/lib/logger'
import { type AdminOrdersSearchParams } from '@/features/store/types'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { connection } from 'next/server'

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
  const locale = isValidLocale(resolvedParams.locale) ? resolvedParams.locale : defaultLocale;
  logger.info('AdminOrdersPage: Using locale', { locale });

  // Step 1: Authenticate and check admin role
  const session = await auth();

  if (!session?.user) {
    redirect(ROUTES.LOGIN(locale));
  }

  if (session.user.role !== UserRole.ADMIN) {
    logger.info('AdminOrdersPage: Non-admin user, redirecting to unauthorized');
    redirect(ROUTES.UNAUTHORIZED(locale));
  }

  // Step 2: Get status filter from search params
  const statusFilter = resolvedSearchParams.status;
  logger.info('AdminOrdersPage: Request details', { 
    locale, 
    statusFilter,
    searchParams: resolvedSearchParams 
  });

  // Step 3: Fetch orders
  const { items: orders } = await getAdminOrders(statusFilter);

  logger.info('AdminOrdersPage: Rendering', { 
    orderCount: orders.length, 
    statusFilter,
    locale 
  });

  return (
    <AdminWrapper locale={locale} pageContext="store">
      <Suspense fallback={
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
        </div>
      }>
        <AdminOrdersClient 
          initialOrders={orders}
          currentStatusFilter={statusFilter}
          locale={locale}
        />
      </Suspense>
    </AdminWrapper>
  );
}


