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
import { getWarehouseStockReport } from '@/features/store/services/warehouse-fulfillment'
import { WarehouseStockPanel } from '@/features/admin/store/warehouse-stock-panel'
import { ZERO_WAREHOUSE_ID } from '@/features/store/constants/stock'
import { ProcessConductor } from '@/lib/processes'

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
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ warehouse?: string }>
}) {
  await connection()

  const { locale: localeParam } = await params
  const { warehouse } = await searchParams
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  const session = await auth()
  if (!session?.user) redirect(ROUTES.LOGIN(locale))
  if (!isPlatformAdmin(session.user.role)) redirect(ROUTES.UNAUTHORIZED(locale))

  const t = await getTranslations('modules.admin')
  const adminLabels = buildModulesAdminLabels(t)
  const report = await getWarehouseStockReport(warehouse || ZERO_WAREHOUSE_ID)
  const [driftRuns, reservationRuns] = await Promise.all([
    ProcessConductor.getRunHistory('inventory-drift', 1).catch(() => []),
    ProcessConductor.getRunHistory('cleanup-reservations', 1).catch(() => []),
  ])
  const drift = driftRuns[0]?.result && typeof driftRuns[0].result === 'object'
    ? driftRuns[0].result as { drifted?: number; samples?: Array<{ productId?: string }> }
    : null
  const reservations = reservationRuns[0]?.result && typeof reservationRuns[0].result === 'object'
    ? reservationRuns[0].result as { released?: number; failed?: number; capped?: boolean; failedIds?: string[] }
    : null
  const stockWatch = {
    drifted: Number(drift?.drifted || 0),
    sampleIds: (drift?.samples || []).map((row) => row.productId).filter((id): id is string => Boolean(id)).slice(0, 8),
    released: Number(reservations?.released || 0),
    failed: Number(reservations?.failed || 0),
    capped: Boolean(reservations?.capped),
    failedIds: Array.isArray(reservations?.failedIds) ? reservations.failedIds.slice(0, 8) : [],
    hasDriftRun: Boolean(drift),
    hasReservationRun: Boolean(reservations),
  }

  return (
    <AdminWrapper locale={locale} pageContext="store" labels={adminLabels}>
      <StoreHubTabs locale={locale} active="stock" />
      <Suspense fallback={<div className="h-64 animate-pulse bg-muted rounded-lg" />}>
        <WarehouseStockPanel report={report} locale={locale} allowSwitcher watch={stockWatch} />
      </Suspense>
    </AdminWrapper>
  )
}
