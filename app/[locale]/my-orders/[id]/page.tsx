import { connection } from 'next/server'
import { notFound, redirect } from 'next/navigation'
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
import { BuyerOrderPanel } from '@/features/crm/orders/buyer-order-panel'

export default async function MyOrderDetailPage({
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
  if (!session?.user?.id) {
    redirect(ROUTES.LOGIN(locale))
  }

  const order = await ProjectOrderService.getById(id)
  if (!order) notFound()

  const admin = isPlatformAdmin(session.user.role)
  if (!admin && order.userId !== session.user.id) {
    redirect(ROUTES.UNAUTHORIZED(locale))
  }

  const users = await resolveCrmUserChips(
    [order.integratorId].filter(Boolean) as string[],
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
    /* buyer hero still works via status endpoint */
  }

  const initialStatuses = computeOrderLabTabStatuses({
    order,
    projectConfig: order.projectConfig,
    envConfig,
    deployment,
  })

  return (
    <BuyerOrderPanel
      initialStatuses={initialStatuses}
      integrator={order.integratorId ? users[order.integratorId] ?? null : null}
      locale={locale}
      order={order}
    />
  )
}
