'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Avatar } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ProjectOrder, ProjectWorkStatus } from '@/features/crm/orders/types'
import { PROJECT_WORK_STATUSES } from '@/features/crm/orders/types'
import type { CrmUserChip } from '@/features/crm/orders/resolve-users'
import { MessageUserButton } from '@/features/auth/components/message-user-button'
import type { Locale } from '@/i18n/shared'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { RINGIZATION_PLAYBOOK_DOCS_PATH } from '@/features/crm/lab/ringization-playbook'

function UserRow({
  user,
  locale,
  action,
}: {
  user: CrmUserChip
  locale: Locale
  action?: React.ReactNode
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded border px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Avatar
          className="h-8 w-8"
          fallback={user.name.slice(0, 2).toUpperCase()}
          size="sm"
          src={user.photoURL}
        />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{user.name}</div>
          {user.email ? <div className="truncate text-xs text-muted-foreground">{user.email}</div> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <MessageUserButton locale={locale} targetUserId={user.id} targetUserName={user.name} />
        {action}
      </div>
    </li>
  )
}

export function CrmOrderDetailClient({
  order: initial,
  users,
  locale,
}: {
  order: ProjectOrder
  users: Record<string, CrmUserChip>
  locale: Locale
}) {
  const router = useRouter()
  const [order, setOrder] = useState(initial)
  const [progress, setProgress] = useState(initial.progress)
  const [integratorId, setIntegratorId] = useState(initial.integratorId ?? '')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const patch = (body: Record<string, unknown>) => {
    setError(null)
    startTransition(async () => {
      const res = await fetch(`/api/admin/crm/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Update failed')
        return
      }
      setOrder(json.order)
      setProgress(json.order.progress)
      setIntegratorId(json.order.integratorId ?? '')
      router.refresh()
    })
  }

  const buyer = users[order.userId]
  const integrator = order.integratorId ? users[order.integratorId] : null

  return (
    <div className="space-y-6">
      {buyer ? (
        <div className="space-y-2">
          <Label>Buyer</Label>
          <ul>
            <UserRow locale={locale} user={buyer} />
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Work status</Label>
          <Select
            disabled={pending}
            value={order.workStatus}
            onValueChange={(v) => patch({ workStatus: v as ProjectWorkStatus })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_WORK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Payment status</Label>
          <Input disabled value={order.paymentStatus} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Progress {progress}%</Label>
        <Slider
          disabled={pending}
          max={100}
          min={0}
          step={1}
          value={[progress]}
          onValueChange={(v) => setProgress(v[0] ?? 0)}
        />
        <Button disabled={pending} size="sm" variant="secondary" onClick={() => patch({ progress })}>
          Save progress
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Integrator user ID</Label>
        <div className="flex gap-2">
          <Input
            disabled={pending}
            placeholder="Member user UUID"
            value={integratorId}
            onChange={(e) => setIntegratorId(e.target.value)}
          />
          <Button
            disabled={pending || !integratorId}
            onClick={() => patch({ integratorId })}
            variant="secondary"
          >
            Assign
          </Button>
        </div>
        {integrator ? (
          <ul>
            <UserRow locale={locale} user={integrator} />
          </ul>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label>Requestors ({order.requestorIds.length})</Label>
        <ul className="space-y-1 text-sm">
          {order.requestorIds.length === 0 ? (
            <li className="text-muted-foreground">No requests yet</li>
          ) : (
            order.requestorIds.map((id) => {
              const user = users[id] ?? { id, name: id.slice(0, 8) + '…' }
              return (
                <UserRow
                  key={id}
                  locale={locale}
                  user={user}
                  action={
                    <Button
                      disabled={pending}
                      size="sm"
                      variant="outline"
                      onClick={() => patch({ integratorId: id, workStatus: 'in_progress' })}
                    >
                      Select
                    </Button>
                  }
                />
              )
            })
          )}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={() => patch({ workStatus: 'available' })}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Publish as available
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/${locale}${RINGIZATION_PLAYBOOK_DOCS_PATH}`}>Open playbook</Link>
        </Button>
        {order.paymentStatus !== 'paid' ? (
          <Button
            disabled={pending}
            variant="secondary"
            onClick={() => patch({ markPaid: true })}
          >
            Mark paid
          </Button>
        ) : null}
        <Button
          disabled={pending}
          variant="destructive"
          onClick={() => {
            if (window.confirm('Cancel this order and attempt refund?')) {
              patch({ cancelAndRefund: true })
            }
          }}
        >
          Cancel & refund
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
