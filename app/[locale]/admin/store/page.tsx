import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
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
import { listAllSettlements } from '@/app/_actions/admin-store-erp'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DEFAULT_INVENTORY_STORE_ID,
  DEFAULT_WAREHOUSE_NAME,
  ZERO_WAREHOUSE_ID,
} from '@/features/store/constants/stock'

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
    path: 'admin.store',
    pathname: '/admin/store',
    robots: { index: false, follow: false },
  })
}

export default async function AdminStoreHubPage({
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
  const th = await getTranslations('modules.admin.storeHub')

  const [summary, settlements] = await Promise.all([
    ERPStockService.getStockSummary(),
    listAllSettlements(50),
  ])
  const pendingSettlements = settlements.filter((s) => s.status === 'pending').length

  return (
    <AdminWrapper locale={locale} pageContext="store" labels={adminLabels}>
      <StoreHubTabs locale={locale} active="hub" />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">{th('hubTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {th('hubSubtitle', {
              warehouse: DEFAULT_WAREHOUSE_NAME,
              warehouseId: ZERO_WAREHOUSE_ID,
              storeId: DEFAULT_INVENTORY_STORE_ID,
            })}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {th('totalProductsLabel')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{summary.totalProducts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {th('lowStockCountLabel')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-amber-600">{summary.lowStockProducts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {th('outOfStockLabel')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-destructive">{summary.outOfStockProducts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {th('pendingSettlements')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{pendingSettlements}</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild variant="default">
            <Link href={ROUTES.ADMIN_STORE_PRODUCTS(locale)}>{th('products')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={ROUTES.ADMIN_STORE_ORDERS(locale)}>{th('orders')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={ROUTES.ADMIN_STORE_STOCK(locale)}>{th('stock')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={ROUTES.ADMIN_STORE_COMMISSIONS(locale)}>{th('commissions')}</Link>
          </Button>
        </div>
      </div>
    </AdminWrapper>
  )
}
