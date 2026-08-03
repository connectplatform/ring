'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { MyJobDetailClient } from '@/features/crm/orders/my-job-detail-client'
import { EnvConfigPanel } from '@/features/crm/lab/env-config-panel'
import { DeployStatusWidget } from '@/features/crm/lab/deploy-status-widget'
import { OrderSourcePanel } from '@/features/crm/lab/order-source/order-source-panel'
import { OrderLabChatRail } from '@/features/crm/lab/order-lab-chat-rail'
import { RingizationPlaybookPanel } from '@/features/crm/lab/ringization-playbook-panel'
import { ProjectConfigPanel } from '@/features/crm/orders/project-config-panel'
import { OwnerSecretsPanel } from '@/features/crm/orders/owner-secrets-panel'
import { WikiDeskPanel } from '@/features/wiki/components/wiki-desk-panel'
import type { ProjectOrder } from '@/features/crm/orders/types'
import type { CrmUserChip } from '@/features/crm/orders/resolve-users'
import type { Locale } from '@/i18n/shared'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants/routes'
import { ExternalLink, MessageSquare } from 'lucide-react'

export function OrderLabShell({
  order,
  buyer,
  locale,
  isAdmin = false,
}: {
  order: ProjectOrder
  buyer: CrmUserChip | null
  locale: Locale
  isAdmin?: boolean
}) {
  const t = useTranslations('calculator')
  const [chatOpen, setChatOpen] = useState(true)
  const niche = order.snapshot?.inputs?.niche?.trim() || order.id

  return (
    <div className="relative mx-auto max-w-4xl space-y-6 p-6 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
            {t('order.lab.badge')}
          </p>
          <h1 className="text-2xl font-bold">{niche}</h1>
          <p className="text-muted-foreground">{t('order.lab.subtitle')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={ROUTES.MY_ORDER(order.id, locale)}>
                <ExternalLink className="mr-1 h-3 w-3" />
                {t('order.openBuyerView', { defaultValue: 'Buyer order view' })}
              </Link>
            </Button>
            {isAdmin ? (
              <Button asChild size="sm" variant="ghost">
                <Link href={ROUTES.ADMIN_CRM_ORDER(order.id, locale)}>
                  {t('order.openAdminCrm', { defaultValue: 'Admin CRM' })}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
        <Button
          className="md:hidden"
          size="sm"
          type="button"
          variant="outline"
          onClick={() => setChatOpen(true)}
        >
          <MessageSquare className="mr-2 h-4 w-4" />
          {t('order.lab.chatTitle')}
        </Button>
      </div>

      <MyJobDetailClient buyer={buyer} hidePageTitle locale={locale} order={order} />
      <RingizationPlaybookPanel locale={locale} role={isAdmin ? 'admin' : 'integrator'} />
      <ProjectConfigPanel mode="integrator" orderId={order.id} />
      <OwnerSecretsPanel orderId={order.id} />
      <WikiDeskPanel appendOnlyTenantHint locale={locale} orderId={order.id} />
      <EnvConfigPanel orderId={order.id} />
      <OrderSourcePanel orderId={order.id} role={isAdmin ? 'admin' : 'integrator'} />
      <DeployStatusWidget orderId={order.id} />

      <OrderLabChatRail open={chatOpen} orderId={order.id} onOpenChange={setChatOpen} />
    </div>
  )
}
