'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { DavinciGlassChip } from '@/lib/ui/davinci'
import {
  tabsForRole,
  type OrderLabRole,
  type OrderLabTabId,
  type OrderLabTabStatus,
} from '@/features/crm/lab/order-lab-tabs'

function StatusDot({ status }: { status: OrderLabTabStatus['status'] }) {
  return (
    <span className="relative inline-flex size-2 shrink-0" aria-hidden>
      <span
        className={cn(
          'absolute inset-0 rounded-full',
          status === 'ok' && 'bg-[var(--davinci-beam)]',
          status === 'incomplete' && 'bg-orange-500',
          status === 'error' && 'bg-red-500',
        )}
      />
      {status === 'ok' ? (
        <span className="absolute inset-0 animate-ping rounded-full bg-[var(--davinci-beam)] opacity-50" />
      ) : null}
    </span>
  )
}

function chipClass(active: boolean, status: OrderLabTabStatus['status']) {
  // Active: beam chrome only — status stays on StatusDot (theme checklist A)
  if (active) {
    return cn(
      'w-full justify-start border-[var(--davinci-beam)] bg-[color-mix(in_oklch,var(--davinci-beam)_16%,transparent)] text-foreground',
    )
  }
  if (status === 'error') {
    return 'w-full justify-start border-red-500/60 text-red-600 dark:text-red-400'
  }
  if (status === 'incomplete') {
    return 'w-full justify-start border-orange-500/60 text-orange-600 dark:text-orange-400'
  }
  return 'w-full justify-start border-[color-mix(in_oklch,var(--davinci-beam)_28%,transparent)] text-[var(--davinci-beam)]'
}

export function OrderLabNavRail({
  role,
  activeTab,
  setActiveTab,
  statuses,
  onNavigate,
}: {
  role: OrderLabRole
  activeTab: OrderLabTabId
  setActiveTab: (id: OrderLabTabId) => void
  statuses: Partial<Record<OrderLabTabId, OrderLabTabStatus>>
  onNavigate?: () => void
}) {
  const t = useTranslations('calculator')
  const tabs = tabsForRole(role)

  return (
    <div className="space-y-2">
      <div className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t('order.lab.sections', { defaultValue: 'Order Lab' })}
      </div>
      <div className="flex flex-col gap-2 px-3">
        {tabs.map((tab) => {
          const status = statuses[tab.id]?.status || 'ok'
          const pending = statuses[tab.id]?.recommendedPending
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id)
                onNavigate?.()
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            >
              <DavinciGlassChip
                className={chipClass(active, status)}
                icon={
                  <span className="flex items-center gap-1.5">
                    <StatusDot status={status} />
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                }
              >
                <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span className="truncate">
                    {t(`order.lab.tabs.${tab.labelKey}`, {
                      defaultValue: tab.labelKey,
                    })}
                  </span>
                  {pending && pending > 0 && status !== 'error' ? (
                    <span className="tabular-nums text-[10px] text-orange-600 dark:text-orange-400">
                      {pending}
                    </span>
                  ) : null}
                </span>
              </DavinciGlassChip>
            </button>
          )
        })}
      </div>
    </div>
  )
}
