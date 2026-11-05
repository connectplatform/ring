import type { Metadata } from 'next'
import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
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
import { listWarehouseAssignmentsAction } from '@/app/_actions/admin-store-erp'
import { getWarehouseStockReport } from '@/features/store/services/warehouse-fulfillment'
import { WarehouseStockPanel } from '@/features/admin/store/warehouse-stock-panel'
import { WarehouseRepresentatives } from '@/features/admin/store/warehouse-representatives'
import { WarehouseSenderForm } from '@/features/admin/store/warehouse-sender-form'
import { ZERO_WAREHOUSE_ID } from '@/features/store/constants/stock'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'admin.store',
    pathname: '/admin/store/warehouses',
    robots: { index: false, follow: false },
  })
}

export default async function AdminWarehouseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  await connection()
  const { locale: localeParam, id } = await params
  const { tab = 'details' } = await searchParams
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  const session = await auth()
  if (!session?.user) redirect(ROUTES.LOGIN(locale))
  if (!isPlatformAdmin(session.user.role)) redirect(ROUTES.UNAUTHORIZED(locale))

  const t = await getTranslations('modules.admin')
  const adminLabels = buildModulesAdminLabels(t)
  const th = await getTranslations('modules.admin.storeHub')
  const report = await getWarehouseStockReport(id)
  const assignments = tab === 'representatives' ? await listWarehouseAssignmentsAction(id) : []
  const href = (next: string) => `${ROUTES.ADMIN_STORE_WAREHOUSE(id, locale)}?tab=${next}`

  return (
    <AdminWrapper locale={locale} pageContext="store" labels={adminLabels}>
      <StoreHubTabs locale={locale} active="warehouses" />
      <div className="space-y-6">
        <div className="flex flex-wrap gap-3 text-sm">
          <Link className={tab === 'details' ? 'font-semibold' : 'underline'} href={href('details')}>
            {th('details')}
          </Link>
          <Link className={tab === 'representatives' ? 'font-semibold' : 'underline'} href={href('representatives')}>
            {th('representatives')}
          </Link>
          <Link className={tab === 'stock' ? 'font-semibold' : 'underline'} href={href('stock')}>
            {th('stock')}
          </Link>
        </div>
        {tab === 'stock' ? <WarehouseStockPanel report={report} locale={locale} /> : null}
        {tab === 'representatives' ? (
          <WarehouseRepresentatives warehouseId={id} assignments={assignments} canEdit />
        ) : null}
        {tab === 'details' ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {report.warehouse.name} · {report.warehouse.code} · {report.warehouse.inventoryStoreId}
              {id === ZERO_WAREHOUSE_ID ? ` · ${th('warehouseDefault')}` : ''}
            </p>
            <WarehouseSenderForm
              warehouseId={id}
              initial={{
                id: report.warehouse.novaPostSenderDivisionId,
                name: report.warehouse.novaPostSenderDivisionName,
                address: report.warehouse.novaPostSenderAddress,
              }}
            />
          </div>
        ) : null}
      </div>
    </AdminWrapper>
  )
}
