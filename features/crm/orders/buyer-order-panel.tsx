'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Avatar } from '@/components/ui/avatar'
import { EmbeddedConversation } from '@/features/crm/lab/order-lab-chat-rail'
import { OwnerSecretsPanel } from '@/features/crm/orders/owner-secrets-panel'
import { ProjectConfigPanel } from '@/features/crm/orders/project-config-panel'
import { RingizationPlaybookPanel } from '@/features/crm/lab/ringization-playbook-panel'
import { OrderSourcePanel } from '@/features/crm/lab/order-source/order-source-panel'
import { WikiDeskPanel } from '@/features/wiki/components/wiki-desk-panel'
import { OrderLabPageShell } from '@/features/crm/lab/order-lab-page-shell'
import { fetchJsonSafe } from '@/features/crm/lab/safe-fetch-json'
import type { OrderLabTabId, OrderLabTabStatus } from '@/features/crm/lab/order-lab-tabs'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import type { ProjectOrder } from '@/features/crm/orders/types'
import type { CrmUserChip } from '@/features/crm/orders/resolve-users'
import { Loader2, ExternalLink, FlaskConical } from 'lucide-react'

type DeploySummary = {
  edge: string
  namespace: string | null
  projectName: string | null
  deploymentName: string | null
  projectUrl: string | null
  lastDeployAt: string | null
  lastDeployStatus: string
  lastError: string | null
}

export function BuyerOrderPanel({
  order: initial,
  integrator,
  locale,
  initialStatuses = {},
}: {
  order: ProjectOrder
  integrator: CrmUserChip | null
  locale: Locale
  initialStatuses?: Partial<Record<OrderLabTabId, OrderLabTabStatus>>
}) {
  const t = useTranslations('calculator')
  const { data: session } = useSession()
  const [order, setOrder] = useState(initial)
  const [deployment, setDeployment] = useState<DeploySummary | null>(null)
  const [labId, setLabId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const boot = async () => {
      setLoading(true)
      try {
        const [detail, chat] = await Promise.all([
          fetchJsonSafe<{
            error?: string
            order?: ProjectOrder
            deployment?: DeploySummary
          }>(`/api/my-orders/${order.id}`),
          fetchJsonSafe<{
            error?: string
            labConversationId?: string
            orderLabConversationId?: string
          }>(`/api/my-jobs/${order.id}/chat`),
        ])
        if (!detail.ok || !detail.data) {
          throw new Error(detail.error || detail.data?.error || 'Failed to load order')
        }
        if (detail.data.error) throw new Error(detail.data.error)
        if (!chat.ok || !chat.data) {
          throw new Error(chat.error || chat.data?.error || 'Failed to open project room')
        }
        if (chat.data.error) throw new Error(chat.data.error)
        if (!cancelled) {
          if (detail.data.order) setOrder(detail.data.order)
          setDeployment(detail.data.deployment ?? null)
          setLabId(chat.data.labConversationId || chat.data.orderLabConversationId || null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [order.id])

  const userId = session?.user?.id
  const niche = order.snapshot?.inputs?.niche?.trim() || order.id

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
          {t('order.buyerBadge')}
        </p>
        <h1 className="text-2xl font-bold">{niche}</h1>
        <p className="text-muted-foreground">{t('order.buyerSubtitle')}</p>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link href={ROUTES.MY_ORDERS(locale)}>{t('order.backToOrders')}</Link>
      </Button>
    </div>
  )

  const overview = (
    <div className="space-y-6">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t('order.orderStatus')}</CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline">{order.paymentStatus}</Badge>
            <Badge>{order.workStatus}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">
              {t('order.progressLabel', { progress: order.progress })}
            </p>
            <Progress value={order.progress} />
          </div>
          <p className="text-sm">
            {order.amount} {order.currency}
          </p>
          {integrator ? (
            <div className="flex items-center gap-2 text-sm">
              <Avatar
                className="h-8 w-8"
                fallback={integrator.name.slice(0, 2).toUpperCase()}
                size="sm"
                src={integrator.photoURL}
              />
              <span>
                {t('order.integratorLabel')}: {integrator.name}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('order.awaitingIntegrator')}</p>
          )}
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded border bg-muted/30 p-3 text-xs">
            {order.details || '—'}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('order.projectStatus')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {loading ? (
            <div className="flex items-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            </div>
          ) : deployment ? (
            <>
              <p>
                <span className="text-muted-foreground">{t('order.lab.edge')}: </span>
                {deployment.edge}
                {deployment.projectName ? ` · ${deployment.projectName}` : ''}
              </p>
              {deployment.namespace ? (
                <p className="font-mono text-xs">
                  {t('order.lab.namespace')}: {deployment.namespace}
                </p>
              ) : null}
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    deployment.lastDeployStatus === 'success'
                      ? 'default'
                      : deployment.lastDeployStatus === 'failed'
                        ? 'destructive'
                        : 'outline'
                  }
                >
                  {deployment.lastDeployStatus}
                </Badge>
                {deployment.projectUrl ? (
                  <Button asChild size="sm" variant="link">
                    <a href={deployment.projectUrl} rel="noreferrer" target="_blank">
                      <ExternalLink className="mr-1 h-3 w-3" />
                      {t('order.openProject')}
                    </a>
                  </Button>
                ) : null}
              </div>
              {deployment.lastError ? (
                <p className="text-xs text-destructive">{deployment.lastError}</p>
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground">{t('order.noDeployYet')}</p>
          )}
        </CardContent>
      </Card>

      <RingizationPlaybookPanel locale={locale} role="buyer" />
      <OrderSourcePanel orderId={order.id} role="buyer" />
      <WikiDeskPanel orderId={order.id} locale={locale} />

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <FlaskConical className="h-4 w-4 text-amber-600" />
          <CardTitle className="text-base">{t('order.lab.projectRoom')}</CardTitle>
        </CardHeader>
        <CardContent className="h-[480px] p-0">
          {loading || !userId ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            </div>
          ) : labId ? (
            <EmbeddedConversation
              conversationId={labId}
              userId={userId}
              variant="order_lab"
            />
          ) : (
            <p className="p-4 text-sm text-muted-foreground">{t('order.lab.noProjectRoom')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )

  return (
    <OrderLabPageShell
      orderId={order.id}
      role="buyer"
      initialStatuses={initialStatuses}
      showHero
      header={header}
      panels={{
        overview,
        project: <ProjectConfigPanel mode="buyer" orderId={order.id} />,
        secrets: <OwnerSecretsPanel orderId={order.id} />,
      }}
    />
  )
}
