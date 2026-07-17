'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import type { ProjectOrder } from '@/features/crm/orders/types'
import { PROJECT_WORK_STATUSES } from '@/features/crm/orders/types'
import type { CrmUserChip } from '@/features/crm/orders/resolve-users'

export function CrmOrdersListClient({
  orders,
  users,
  locale,
  currentWorkStatus,
}: {
  orders: ProjectOrder[]
  users: Record<string, CrmUserChip>
  locale: Locale
  currentWorkStatus?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const onFilter = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') params.set('workStatus', value)
    else params.delete('workStatus')
    startTransition(() => {
      router.push(`${ROUTES.ADMIN_CRM_ORDERS(locale)}?${params.toString()}`)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select disabled={pending} value={currentWorkStatus || 'all'} onValueChange={onFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Work status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {PROJECT_WORK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button disabled={pending} size="sm" variant="outline" onClick={() => router.refresh()}>
          Refresh
        </Button>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-muted-foreground">No project orders yet.</CardContent>
        </Card>
      ) : (
        orders.map((order) => {
          const buyer = users[order.userId]
          return (
            <Card key={order.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">
                  <Link className="hover:underline" href={ROUTES.ADMIN_CRM_ORDER(order.id, locale)}>
                    {order.id}
                  </Link>
                </CardTitle>
                <div className="flex gap-2">
                  <Badge variant="outline">{order.paymentStatus}</Badge>
                  <Badge>{order.workStatus}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-4 text-muted-foreground">
                  <span>
                    {order.amount} {order.currency}
                  </span>
                  <span>Progress {order.progress}%</span>
                  <span>Requestors {order.requestorIds.length}</span>
                  <span>Buyer {buyer?.name ?? `${order.userId.slice(0, 8)}…`}</span>
                </div>
                <pre className="max-h-24 overflow-hidden whitespace-pre-wrap text-xs opacity-80">
                  {order.details}
                </pre>
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
