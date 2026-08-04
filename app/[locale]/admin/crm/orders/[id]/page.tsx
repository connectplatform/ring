import type { Metadata } from 'next'
import { connection } from 'next/server'
import { redirect, notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { ProjectOrderService } from '@/features/crm/orders/project-order-service'
import { resolveCrmUserChips } from '@/features/crm/orders/resolve-users'
import { ProjectDeploymentService } from '@/features/crm/lab/deployment-service'
import { computeOrderLabTabStatuses } from '@/features/crm/lab/order-lab-tab-status'
import { AdminOrderLabClient } from '@/features/crm/lab/admin-order-lab-client'
import { CrmAdminShell } from '@/features/admin/crm/crm-admin-shell'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}): Promise<Metadata> {
  const { locale: localeParam, id } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  return buildLocalizedMetadata({
    locale,
    path: 'admin.crm.order',
    pathname: `/admin/crm/orders/${id}`,
    robots: { index: false, follow: false },
  })
}

export default async function AdminCrmOrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  await connection()
  const { locale: localeParam, id } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user?.id || !isPlatformAdmin(session.user.role)) {
    redirect(ROUTES.UNAUTHORIZED(locale))
  }

  const order = await ProjectOrderService.getById(id)
  if (!order) notFound()

  const users = await resolveCrmUserChips(
    [order.userId, order.integratorId, ...order.requestorIds].filter(Boolean) as string[],
  )

  let envConfig: Record<string, { value?: string | null }> | null = null
  let deployment: {
    lastDeployStatus?: string | null
    lastError?: string | null
    namespace?: string | null
    projectUrl?: string | null
  } | null = null
  try {
    const dep = await ProjectDeploymentService.getOrCreate(id)
    envConfig = dep.envConfig
    deployment = {
      lastDeployStatus: dep.lastDeployStatus,
      lastError: dep.lastError,
      namespace: dep.namespace,
      projectUrl: dep.projectUrl,
    }
  } catch {
    envConfig = null
    deployment = null
  }

  const initialStatuses = computeOrderLabTabStatuses({
    order,
    projectConfig: order.projectConfig,
    envConfig,
    deployment,
  })

  return (
    <CrmAdminShell pageContext="crm-orders">
      <AdminOrderLabClient
        order={order}
        locale={locale}
        users={users}
        initialStatuses={initialStatuses}
      />
    </CrmAdminShell>
  )
}
