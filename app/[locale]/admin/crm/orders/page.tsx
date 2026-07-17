import type { Metadata } from 'next'
import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { setRequestLocale } from 'next-intl/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { ProjectOrderService } from '@/features/crm/orders/project-order-service'
import { resolveCrmUserChips } from '@/features/crm/orders/resolve-users'
import { CrmOrdersListClient } from '@/features/crm/orders/crm-orders-list-client'
import type { ProjectWorkStatus } from '@/features/crm/orders/types'
import { PROJECT_WORK_STATUSES } from '@/features/crm/orders/types'
import { CrmAdminShell } from '@/features/admin/crm/crm-admin-shell'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  return buildLocalizedMetadata({
    locale,
    path: 'admin.crm.orders',
    pathname: '/admin/crm/orders',
    robots: { index: false, follow: false },
  })
}

export default async function AdminCrmOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ workStatus?: string }>
}) {
  await connection()
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user?.id || !isPlatformAdmin(session.user.role)) {
    redirect(ROUTES.UNAUTHORIZED(locale))
  }

  const sp = await searchParams
  const workStatus =
    sp.workStatus && PROJECT_WORK_STATUSES.includes(sp.workStatus as ProjectWorkStatus)
      ? (sp.workStatus as ProjectWorkStatus)
      : undefined

  const orders = await ProjectOrderService.listAdmin({ workStatus, limit: 100 })
  const userIds = orders.flatMap((o) => [o.userId, o.integratorId, ...o.requestorIds].filter(Boolean) as string[])
  const users = await resolveCrmUserChips(userIds)

  return (
    <CrmAdminShell pageContext="crm-orders">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">CRM Custom Orders</h1>
          <p className="text-muted-foreground">
            Calculator ringization deposits — statuses, requestors, integrators
          </p>
        </div>
        <Suspense fallback={<div className="text-muted-foreground">Loading…</div>}>
          <CrmOrdersListClient
            currentWorkStatus={workStatus}
            locale={locale}
            orders={orders}
            users={users}
          />
        </Suspense>
      </div>
    </CrmAdminShell>
  )
}
