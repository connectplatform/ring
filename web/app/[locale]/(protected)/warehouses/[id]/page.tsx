import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { connection } from 'next/server'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { assertWarehouseOperator, listWarehouseAssignmentsAction } from '@/app/_actions/admin-store-erp'
import { getWarehouseStockReport } from '@/features/store/services/warehouse-fulfillment'
import { WarehouseStockPanel } from '@/features/admin/store/warehouse-stock-panel'
import { WarehouseRepresentatives } from '@/features/admin/store/warehouse-representatives'

export default async function MyWarehousePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  await connection()
  const { locale: localeParam, id } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  const session = await auth()
  if (!session?.user) redirect(ROUTES.LOGIN(locale))
  let role: string = 'worker'
  try {
    const access = await assertWarehouseOperator(id)
    role = access.role
  } catch {
    redirect(ROUTES.UNAUTHORIZED(locale))
  }
  const report = await getWarehouseStockReport(id)
  const assignments =
    role === 'manager' || isPlatformAdmin(session.user.role)
      ? await listWarehouseAssignmentsAction(id)
      : []

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <WarehouseStockPanel report={report} locale={locale} />
      {role === 'worker' ? null : (
        <WarehouseRepresentatives
          warehouseId={id}
          assignments={assignments}
          canEdit={role === 'manager' || isPlatformAdmin(session.user.role)}
        />
      )}
    </div>
  )
}
