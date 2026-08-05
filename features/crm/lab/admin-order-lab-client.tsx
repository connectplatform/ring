'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CrmOrderDetailClient } from '@/features/crm/orders/crm-order-detail-client'
import { AdminCrmChatTabs } from '@/features/crm/lab/admin-crm-chat-tabs'
import { AdminNamespaceEditor } from '@/features/crm/lab/admin-namespace-editor'
import { DeployStatusWidget } from '@/features/crm/lab/deploy-status-widget'
import { EnvConfigPanel } from '@/features/crm/lab/env-config-panel'
import { OrderSourcePanel } from '@/features/crm/lab/order-source/order-source-panel'
import { OrderLabPageShell } from '@/features/crm/lab/order-lab-page-shell'
import type { OrderLabTabStatus } from '@/features/crm/lab/order-lab-tabs'
import type { OrderLabTabId } from '@/features/crm/lab/order-lab-tabs'
import { ProjectConfigPanel } from '@/features/crm/orders/project-config-panel'
import { OwnerSecretsPanel } from '@/features/crm/orders/owner-secrets-panel'
import type { ProjectOrder } from '@/features/crm/orders/types'
import type { CrmUserChip } from '@/features/crm/orders/resolve-users'
import type { Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'

export function AdminOrderLabClient({
  order,
  locale,
  users,
  initialStatuses,
}: {
  order: ProjectOrder
  locale: Locale
  users: Record<string, CrmUserChip>
  initialStatuses: Partial<Record<OrderLabTabId, OrderLabTabStatus>>
}) {
  const header = (
    <div className="flex flex-wrap items-start justify-between gap-4">
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
  )

  return (
    <OrderLabPageShell
      orderId={order.id}
      role="admin"
      initialStatuses={initialStatuses}
      header={header}
      panels={{
        overview: (
          <Card>
            <CardHeader>
              <CardTitle>Order details</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm">{order.details || '—'}</pre>
              <p className="mt-4 text-sm text-muted-foreground">
                {order.opportunityId ? (
                  <Link
                    className="underline"
                    href={ROUTES.OPPORTUNITY(order.opportunityId, locale)}
                  >
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
        ),
        manage: <CrmOrderDetailClient locale={locale} order={order} users={users} />,
        project: <ProjectConfigPanel mode="integrator" orderId={order.id} />,
        secrets: <OwnerSecretsPanel orderId={order.id} />,
        env: <EnvConfigPanel orderId={order.id} />,
        source: <OrderSourcePanel orderId={order.id} role="admin" />,
        deploy: (
          <div className="space-y-6">
            <DeployStatusWidget orderId={order.id} />
            <AdminNamespaceEditor orderId={order.id} />
          </div>
        ),
        chats: <AdminCrmChatTabs orderId={order.id} />,
      }}
    />
  )
}
