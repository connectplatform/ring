'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { TaskEscrow } from '@/features/tasks/types/escrow'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import { Loader2 } from 'lucide-react'

type EscrowRow = TaskEscrow & {
  taskStatus: string | null
  disputed: boolean
  messagePreview: string
}

export function CrmTaskEscrowsListClient({
  escrows,
  locale,
}: {
  escrows: EscrowRow[]
  locale: Locale
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left">
            <th className="p-3">Escrow</th>
            <th className="p-3">Amount</th>
            <th className="p-3">Status</th>
            <th className="p-3">Task</th>
            <th className="p-3">Updated</th>
          </tr>
        </thead>
        <tbody>
          {escrows.length === 0 ? (
            <tr>
              <td colSpan={5} className="p-6 text-center text-muted-foreground">
                No held or disputed task escrows
              </td>
            </tr>
          ) : (
            escrows.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="p-3">
                  <Link
                    className="font-medium text-primary hover:underline"
                    href={ROUTES.ADMIN_CRM_TASK_ESCROW(row.id, locale)}
                  >
                    {row.id.slice(0, 8)}…
                  </Link>
                </td>
                <td className="p-3">
                  {row.amount} {row.currencyCode ?? row.currencyType}
                </td>
                <td className="p-3">
                  <Badge variant={row.disputed ? 'destructive' : 'secondary'}>
                    {row.disputed ? 'disputed' : row.paymentStatus}
                  </Badge>
                </td>
                <td className="p-3 text-muted-foreground">{row.taskStatus ?? '—'}</td>
                <td className="p-3 text-muted-foreground">
                  {new Date(row.updatedAt).toLocaleString()}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export function CrmTaskEscrowDetailClient({
  escrowId,
  locale,
  initial,
}: {
  escrowId: string
  locale: Locale
  initial: {
    escrow: TaskEscrow
    messagePreview: string
    taskStatus: string | null
    reporterUserId: string
    assigneeUserId: string | null
  }
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const runAction = (action: 'release' | 'refund' | 'cancel') => {
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/crm/task-escrows/${encodeURIComponent(escrowId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Action failed')
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Action failed')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md border p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge>{initial.escrow.paymentStatus}</Badge>
          {initial.taskStatus ? <Badge variant="outline">{initial.taskStatus}</Badge> : null}
        </div>
        <p className="text-sm whitespace-pre-wrap">{initial.messagePreview}</p>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Amount</dt>
            <dd>
              {initial.escrow.amount}{' '}
              {initial.escrow.currencyCode ?? initial.escrow.currencyType}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Reporter</dt>
            <dd className="font-mono text-xs">{initial.reporterUserId}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Assignee</dt>
            <dd className="font-mono text-xs">{initial.assigneeUserId ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Conversation</dt>
            <dd>
              <Link
                className="text-primary hover:underline"
                href={ROUTES.MESSAGES(locale) + `?c=${encodeURIComponent(initial.escrow.conversationId)}`}
              >
                Open chat
              </Link>
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={() => runAction('release')}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Release to assignee
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => runAction('refund')}>
          Refund reporter
        </Button>
        <Button variant="destructive" disabled={pending} onClick={() => runAction('cancel')}>
          Force cancel
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
