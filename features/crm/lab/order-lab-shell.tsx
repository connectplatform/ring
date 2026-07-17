'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { MyJobDetailClient } from '@/features/crm/orders/my-job-detail-client'
import { EnvConfigPanel } from '@/features/crm/lab/env-config-panel'
import { DeployStatusWidget } from '@/features/crm/lab/deploy-status-widget'
import { OrderLabChatRail } from '@/features/crm/lab/order-lab-chat-rail'
import type { ProjectOrder } from '@/features/crm/orders/types'
import type { CrmUserChip } from '@/features/crm/orders/resolve-users'
import type { Locale } from '@/i18n/shared'
import { Button } from '@/components/ui/button'
import { MessageSquare } from 'lucide-react'

export function OrderLabShell({
  order,
  buyer,
  locale,
}: {
  order: ProjectOrder
  buyer: CrmUserChip | null
  locale: Locale
}) {
  const t = useTranslations('calculator')
  const [chatOpen, setChatOpen] = useState(true)

  return (
    <div className="relative mx-auto max-w-4xl space-y-6 p-6 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
            {t('order.lab.badge')}
          </p>
          <h1 className="text-2xl font-bold">{t('order.lab.title')}</h1>
          <p className="text-muted-foreground">{t('order.lab.subtitle')}</p>
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

      <MyJobDetailClient buyer={buyer} locale={locale} order={order} />
      <EnvConfigPanel orderId={order.id} />
      <DeployStatusWidget orderId={order.id} />

      <OrderLabChatRail open={chatOpen} orderId={order.id} onOpenChange={setChatOpen} />
    </div>
  )
}
