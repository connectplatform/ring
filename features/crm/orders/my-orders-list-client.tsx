'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Avatar } from '@/components/ui/avatar'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import type { ProjectOrder } from '@/features/crm/orders/types'
import type { CrmUserChip } from '@/features/crm/orders/resolve-users'
import { cn } from '@/lib/utils'

type DeskFilter = 'all' | 'active' | 'completed' | 'paid'

function nicheTitle(order: ProjectOrder): string {
  return order.snapshot?.inputs?.niche?.trim() || order.id
}

export function MyOrdersListClient({
  orders,
  users,
  locale,
  currentFilter,
}: {
  orders: ProjectOrder[]
  users: Record<string, CrmUserChip>
  locale: Locale
  currentFilter: DeskFilter
}) {
  const t = useTranslations('calculator')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const paidCount = orders.filter((o) => o.paymentStatus === 'paid').length
  const activeCount = orders.filter((o) => o.workStatus === 'in_progress').length
  const completedCount = orders.filter((o) => o.workStatus === 'completed').length

  const filtered = orders.filter((order) => {
    if (currentFilter === 'active') return order.workStatus === 'in_progress'
    if (currentFilter === 'completed') return order.workStatus === 'completed'
    if (currentFilter === 'paid') return order.paymentStatus === 'paid'
    return true
  })

  const setFilter = (filter: DeskFilter) => {
    const params = new URLSearchParams(searchParams.toString())
    if (filter === 'all') params.delete('filter')
    else params.set('filter', filter)
    const qs = params.toString()
    startTransition(() => {
      router.push(qs ? `${ROUTES.MY_ORDERS(locale)}?${qs}` : ROUTES.MY_ORDERS(locale))
    })
  }

  const filters: { id: DeskFilter; label: string }[] = [
    { id: 'all', label: t('order.filterAll') },
    { id: 'paid', label: t('order.filterPaid') },
    { id: 'active', label: t('order.filterActive') },
    { id: 'completed', label: t('order.filterCompleted') },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t('order.kpiPaid')}</p>
            <p className="text-2xl font-semibold">{paidCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t('order.kpiActive')}</p>
            <p className="text-2xl font-semibold">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t('order.kpiCompleted')}</p>
            <p className="text-2xl font-semibold">{completedCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Button
            key={f.id}
            disabled={pending}
            size="sm"
            type="button"
            variant={currentFilter === f.id ? 'default' : 'outline'}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 p-8 text-center">
            <p className="text-muted-foreground">{t('order.buyerEmpty')}</p>
            <Button asChild>
              <Link href={ROUTES.CALCULATOR(locale)}>{t('order.openCalculator')}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {filtered.map((order) => {
            const integrator = order.integratorId ? users[order.integratorId] : null
            return (
              <li key={order.id}>
                <Card className={cn(order.workStatus === 'disputed' && 'border-destructive/40')}>
                  <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="truncate text-base">
                        <Link
                          className="hover:underline"
                          href={ROUTES.MY_ORDER(order.id, locale)}
                        >
                          {nicheTitle(order)}
                        </Link>
                      </CardTitle>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{order.paymentStatus}</Badge>
                        <Badge>{order.workStatus}</Badge>
                      </div>
                    </div>
                    <Button asChild size="sm" variant="secondary">
                      <Link href={ROUTES.MY_ORDER(order.id, locale)}>{t('order.openLab')}</Link>
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">
                        {t('order.progressLabel', { progress: order.progress })}
                      </p>
                      <Progress value={order.progress} />
                    </div>
                    {integrator ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Avatar
                          className="h-7 w-7"
                          fallback={integrator.name.slice(0, 2).toUpperCase()}
                          size="sm"
                          src={integrator.photoURL}
                        />
                        <span className="truncate text-muted-foreground">
                          {t('order.integratorLabel')}: {integrator.name}
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">{t('order.awaitingIntegrator')}</p>
                    )}
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
