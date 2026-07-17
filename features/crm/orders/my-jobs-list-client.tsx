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
import { MessageUserButton } from '@/features/auth/components/message-user-button'
import { cn } from '@/lib/utils'

type DeskFilter = 'all' | 'active' | 'completed' | 'disputed'

function nicheTitle(order: ProjectOrder): string {
  return order.snapshot?.inputs?.niche?.trim() || order.id
}

export function MyJobsListClient({
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

  const activeCount = orders.filter((o) => o.workStatus === 'in_progress').length
  const completedCount = orders.filter((o) => o.workStatus === 'completed').length
  const disputedCount = orders.filter((o) => o.workStatus === 'disputed').length

  const filtered = orders.filter((order) => {
    if (currentFilter === 'active') return order.workStatus === 'in_progress'
    if (currentFilter === 'completed') return order.workStatus === 'completed'
    if (currentFilter === 'disputed') return order.workStatus === 'disputed'
    return true
  })

  const setFilter = (filter: DeskFilter) => {
    const params = new URLSearchParams(searchParams.toString())
    if (filter === 'all') params.delete('workStatus')
    else params.set('workStatus', filter)
    const qs = params.toString()
    startTransition(() => {
      router.push(qs ? `${ROUTES.MY_JOBS(locale)}?${qs}` : ROUTES.MY_JOBS(locale))
    })
  }

  const filters: { id: DeskFilter; label: string }[] = [
    { id: 'all', label: t('order.filterAll') },
    { id: 'active', label: t('order.filterActive') },
    { id: 'completed', label: t('order.filterCompleted') },
    { id: 'disputed', label: t('order.filterDisputed') },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
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
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t('order.kpiDisputed')}</p>
            <p className="text-2xl font-semibold">{disputedCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <Button
            key={f.id}
            disabled={pending}
            size="sm"
            variant={currentFilter === f.id ? 'default' : 'outline'}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </Button>
        ))}
        <Button
          asChild
          className="ml-auto"
          size="sm"
          variant="secondary"
        >
          <Link href={`${ROUTES.OPPORTUNITIES(locale)}?types=ring_customization`}>
            {t('order.findWork')}
          </Link>
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 p-6 text-muted-foreground">
            <p>{t('order.myJobsEmpty')}</p>
            <Button asChild variant="outline">
              <Link href={`${ROUTES.OPPORTUNITIES(locale)}?types=ring_customization`}>
                {t('order.findWork')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        filtered.map((order) => {
          const buyer = users[order.userId]
          const hours = order.snapshot?.results?.estimatedHours
          return (
            <Card key={order.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="truncate text-base">
                    <Link
                      className="hover:underline"
                      href={ROUTES.MY_JOB(order.id, locale)}
                    >
                      {nicheTitle(order)}
                    </Link>
                  </CardTitle>
                  <p className="truncate text-xs text-muted-foreground">{order.id}</p>
                </div>
                <Badge className={cn(order.workStatus === 'disputed' && 'bg-destructive')}>
                  {order.workStatus}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Progress value={order.progress} />
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>{t('order.progressComplete', { progress: order.progress })}</span>
                    {typeof hours === 'number' ? (
                      <span>{t('order.estHours', { hours })}</span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar
                      className="h-8 w-8"
                      fallback={(buyer?.name ?? '?').slice(0, 2).toUpperCase()}
                      size="sm"
                      src={buyer?.photoURL}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {buyer?.name ?? `${order.userId.slice(0, 8)}…`}
                      </p>
                      <p className="text-xs text-muted-foreground">{t('order.client')}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {buyer ? (
                      <MessageUserButton
                        locale={locale}
                        targetUserId={buyer.id}
                        targetUserName={buyer.name}
                      />
                    ) : null}
                    <Button asChild size="sm">
                      <Link href={ROUTES.MY_JOB(order.id, locale)}>{t('order.openJob')}</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
