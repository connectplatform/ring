import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { getTranslations } from 'next-intl/server'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import { connection } from 'next/server'
import StoreHubTabs from '@/components/admin/store-hub-tabs'
import { ERPStockService } from '@/features/store/services/erp-stock-service'
import AdminStockClient from './admin-stock-client'

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
    path: 'admin.store.stock',
    pathname: '/admin/store/stock',
    robots: { index: false, follow: false },
  })
}

export default async function AdminStoreStockPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection()

  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  const session = await auth()
  if (!session?.user) redirect(ROUTES.LOGIN(locale))
  if (!isPlatformAdmin(session.user.role)) redirect(ROUTES.UNAUTHORIZED(locale))

  const t = await getTranslations('modules.admin')
  const adminLabels = buildModulesAdminLabels(t)

  const [summary, lowStockProducts, movements] = await Promise.all([
    ERPStockService.getStockSummary(),
    ERPStockService.getLowStockProducts(),
    ERPStockService.getRecentStockMovements(25),
  ])

  const tabLabels = {
    orders: t('storeHub.orders'),
    stock: t('storeHub.stock'),
    commissions: t('storeHub.commissions'),
  }

  const stockLabels = {
    title: t('storeHub.stockTitle'),
    initialize: t('storeHub.initializeStock'),
    initializing: t('storeHub.initializingStock'),
    summary: t('storeHub.stockSummary'),
    lowStock: t('storeHub.lowStock'),
    movements: t('storeHub.movements'),
    product: t('storeHub.product'),
    stock: t('storeHub.stock'),
    type: t('storeHub.movementType'),
    change: t('storeHub.quantityChange'),
    when: t('storeHub.timestamp'),
    totalProductsLabel: t('storeHub.totalProductsLabel'),
    inStockLabel: t('storeHub.inStockLabel'),
    lowStockCountLabel: t('storeHub.lowStockCountLabel'),
    criticalLabel: t('storeHub.criticalLabel'),
    outOfStockLabel: t('storeHub.outOfStockLabel'),
    inventoryValueLabel: t('storeHub.inventoryValueLabel'),
    noLowStockAlerts: t('storeHub.noLowStockAlerts'),
    noMovementsYet: t('storeHub.noMovementsYet'),
    stockUnits: t('storeHub.stockUnits'),
    initStockError: t('storeHub.initStockError'),
  }

  return (
    <AdminWrapper locale={locale} pageContext="store" labels={adminLabels}>
      <StoreHubTabs locale={locale} active="stock" labels={tabLabels} />
      <Suspense fallback={<div className="h-64 animate-pulse bg-muted rounded-lg" />}>
        <AdminStockClient
          summary={summary}
          lowStockProducts={lowStockProducts}
          movements={movements}
          labels={stockLabels}
        />
      </Suspense>
    </AdminWrapper>
  )
}
