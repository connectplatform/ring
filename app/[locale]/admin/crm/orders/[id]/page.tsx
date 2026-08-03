import type { Metadata } from 'next'
import { connection } from 'next/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { ProjectOrderService } from '@/features/crm/orders/project-order-service'
import { resolveCrmUserChips } from '@/features/crm/orders/resolve-users'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CrmOrderDetailClient } from './crm-order-detail-client'
import { AdminCrmChatTabs } from '@/features/crm/lab/admin-crm-chat-tabs'
import { AdminNamespaceEditor } from '@/features/crm/lab/admin-namespace-editor'
import { ProjectConfigPanel } from '@/features/crm/orders/project-config-panel'
import { OwnerSecretsPanel } from '@/features/crm/orders/owner-secrets-panel'
import { EnvConfigPanel } from '@/features/crm/lab/env-config-panel'
import { DeployStatusWidget } from '@/features/crm/lab/deploy-status-widget'
import { OrderSourcePanel } from '@/features/crm/lab/order-source/order-source-panel'
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

  return (
    <CrmAdminShell pageContext="crm-orders">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Button asChild variant="ghost" size="sm">
              <Link href={ROUTES.ADMIN_CRM_ORDERS(locale)}>← All custom orders</Link>
            </Button>
            <h1 className="text-2xl font-bold">{order.id}</h1>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">{order.paymentStatus}</Badge>
            <Badge>{order.workStatus}</Badge>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Order details</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm">{order.details}</pre>
            <p className="mt-4 text-sm text-muted-foreground">
              {order.opportunityId ? (
                <Link className="underline" href={ROUTES.OPPORTUNITY(order.opportunityId, locale)}>
                  Opportunity
                </Link>
              ) : (
                'No opportunity published yet'
              )}
              {' · '}
              <Link className="underline" href={ROUTES.MY_ORDER(order.id, locale)}>
                Buyer view
              </Link>
              {order.integratorId ? (
                <>
                  {' · '}
                  <Link className="underline" href={ROUTES.MY_JOB(order.id, locale)}>
                    Integrator lab
                  </Link>
                </>
              ) : null}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manage</CardTitle>
          </CardHeader>
          <CardContent>
            <CrmOrderDetailClient locale={locale} order={order} users={users} />
          </CardContent>
        </Card>

        {/* Reuse buyer/integrator custom-order panels */}
        <ProjectConfigPanel mode="integrator" orderId={order.id} />
        <OwnerSecretsPanel orderId={order.id} />
        <EnvConfigPanel orderId={order.id} />
        <OrderSourcePanel orderId={order.id} role="admin" />
        <DeployStatusWidget orderId={order.id} />

        <AdminNamespaceEditor orderId={order.id} />
        <AdminCrmChatTabs orderId={order.id} />
      </div>
    </CrmAdminShell>
  )
}
