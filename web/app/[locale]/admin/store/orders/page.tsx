import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
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
import {
  ADMIN_LIST_PAGE_SIZE,
  toAdminOrderDto,
  type AdminOrderDto,
} from '@/lib/admin/admin-list-dto'

const AdminOrdersClient = dynamicImport(() => import('./admin-orders-client'), {
  loading: () => (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
    </div>
  ),
})

async function getAdminOrders(statusFilter?: string): Promise<{
  items: AdminOrderDto[]
  hasMore: boolean
  nextOffset: number
}> {
  try {
    logger.info('AdminOrders: Fetching orders with filter', { statusFilter })

    const options = {
      limit: ADMIN_LIST_PAGE_SIZE,
      offset: 0,
      ...(statusFilter
        ? {
            statusFilter: statusFilter as
              | 'new'
              | 'paid'
              | 'processing'
              | 'shipped'
              | 'completed'
              | 'canceled',
          }
        : {}),
    }

    const result = await StoreOrdersService.adminListAllOrders(options)
    const items = result.items.map((row) =>
      toAdminOrderDto(row as Record<string, unknown> & { id: string }),
    )
    logger.info('AdminOrders: Orders fetched successfully', { count: items.length })

    return { items, hasMore: result.hasMore, nextOffset: result.nextOffset }
  } catch (error) {
    logger.error('AdminOrders: Error fetching orders:', error)
    return { items: [], hasMore: false, nextOffset: 0 }
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
  const t = await getTranslations({ locale, namespace: 'modules.admin.storeHub.ordersPage' })
  return {
    title: t('title'),
    robots: { index: false, follow: false },
  }
}

export default async function AdminOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<AdminOrdersSearchParams>
}) {
  await connection()

  logger.info('AdminOrdersPage: Starting')

  const resolvedParams = await params
  const resolvedSearchParams = await searchParams

  const validLocale: Locale = routing.locales.includes(resolvedParams.locale as Locale)
    ? (resolvedParams.locale as Locale)
    : (routing.defaultLocale as Locale)
  logger.info('AdminOrdersPage: Using locale', { locale: validLocale })
  const t = await getTranslations('modules.admin')
  const adminLabels = buildModulesAdminLabels(t)

  const session = await auth()

  if (!session?.user) {
    redirect(ROUTES.LOGIN(validLocale))
  }

  if (!isPlatformAdmin(session.user.role)) {
    logger.info('AdminOrdersPage: Non-admin user, redirecting to unauthorized')
    redirect(ROUTES.UNAUTHORIZED(validLocale))
  }

  const statusFilter = resolvedSearchParams.status
  logger.info('AdminOrdersPage: Request details', {
    locale: validLocale,
    statusFilter,
    searchParams: resolvedSearchParams,
  })

  const { items: orders, hasMore, nextOffset } = await getAdminOrders(statusFilter)

  logger.info('AdminOrdersPage: Rendering', {
    orderCount: orders.length,
    statusFilter,
    locale: validLocale,
  })

  return (
    <AdminWrapper locale={validLocale} pageContext="store" labels={adminLabels}>
      <StoreHubTabs locale={validLocale} active="orders" />
      <Suspense
        fallback={
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
          </div>
        }
      >
        <AdminOrdersClient
          initialOrders={orders}
          initialHasMore={hasMore}
          initialNextOffset={nextOffset}
          currentStatusFilter={statusFilter}
          locale={validLocale}
        />
      </Suspense>
    </AdminWrapper>
  )
}
