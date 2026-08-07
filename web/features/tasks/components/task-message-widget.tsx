'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ListTodo, Loader2, Pencil, Trash2 } from 'lucide-react'
import type { Message, TaskMetadata } from '@/features/chat/types'
import {
  formatTaskBudget,
  formatTaskDeadlineI18n,
  parseTaskMetadata,
  taskTitleFromContent,
} from '@/features/tasks/types'
import {
  acceptTask,
  approveTaskRequest,
  cancelTask,
  completeTask,
  convertTaskToOpportunity,
  deleteTask,
  disputeTask,
  editTaskContent,
  rejectTaskRequest,
  requestTask,
  startTask,
} from '@/app/_actions/tasks'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

export interface TaskMessageWidgetProps {
  message: Message
  isOwn: boolean
  currentUserId?: string
  className?: string
}

export function TaskMessageWidget({
  message,
  isOwn: _isOwn,
  currentUserId,
  className,
}: TaskMessageWidgetProps) {
  const t = useTranslations('modules.tasks')
  const tCommon = useTranslations('common')
  const [localMeta, setLocalMeta] = useState<Partial<TaskMetadata> | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const base = parseTaskMetadata(message)
  const task = useMemo(() => {
    if (!base) return null
    return { ...base, ...localMeta } as TaskMetadata
  }, [base, localMeta])

  if (!task) {
    return <div className="whitespace-pre-wrap">{message.content}</div>
  }

  const userId = currentUserId
  const isReporter = Boolean(userId) && userId === task.reporterUserId
  const isAssignee = Boolean(userId) && userId === task.assigneeUserId
  const status = task.status
  const deadlineLabel = formatTaskDeadlineI18n(task.deadline, t)
  const budgetLabel = formatTaskBudget(task.budget)
  const title = taskTitleFromContent(message.content)
  const bodyAfterTitle = (() => {
    if (message.content === title) return null
    const titleLines = title.split('\n').length
    const rest = message.content
      .split('\n')
      .slice(titleLines)
      .join('\n')
      .trim()
    return rest || null
  })()

  const runAction = async (key: string, fn: () => Promise<{ success: boolean; error?: string; data?: Message }>) => {
    try {
      setBusy(key)
      const result = await fn()
      if (!result.success) throw new Error(result.error || t('actionFailed'))
      if (result.data?.metadata && typeof result.data.metadata === 'object') {
        setLocalMeta(result.data.metadata as unknown as TaskMetadata)
      }
      toast({ title: t('updated') })
    } catch (error) {
      toast({
        title: tCommon('status.error'),
        description: error instanceof Error ? error.message : t('actionFailed'),
        variant: 'destructive',
      })
    } finally {
      setBusy(null)
    }
  }

  const escrowPs = task.escrow?.paymentStatus ?? 'none'
  const escrowEnabled = Boolean(task.escrow?.enabled)
  const escrowHeld = escrowEnabled && escrowPs === 'held'
  const escrowBlocksLifecycle = escrowEnabled && (escrowPs === 'pending' || escrowPs === 'failed')

  const canStart =
    Boolean(userId) &&
    !isReporter &&
    status === 'available' &&
    !escrowBlocksLifecycle
  const canRequest =
    Boolean(userId) &&
    !isReporter &&
    status === 'available' &&
    !escrowBlocksLifecycle
  const canApprove = isReporter && status === 'requested'
  const canReject = isReporter && status === 'requested'
  const canComplete =
    status === 'in_progress' && (isReporter || isAssignee) && !escrowBlocksLifecycle
  // Accept: release when held; allow when no money held (none/refunded); block pending/failed
  const canAccept =
    isReporter &&
    status === 'completed' &&
    !escrowBlocksLifecycle &&
    (!escrowHeld || Boolean(task.assigneeUserId))
  const canDispute = isReporter && status === 'completed' && escrowHeld
  const canConvert =
    isReporter &&
    status !== 'canceled' &&
    !task.opportunityId
  const canCancel =
    isReporter && ['available', 'requested', 'in_progress', 'disputed'].includes(status)
  const canEdit =
    isReporter &&
    status === 'available' &&
    escrowPs !== 'held' &&
    escrowPs !== 'released'
  const canDelete =
    isReporter &&
    ['available', 'requested', 'canceled'].includes(status) &&
    ['none', 'refunded', 'failed'].includes(escrowPs)

  const handleEditSave = async () => {
    await runAction('edit', () => editTaskContent(message.id, editContent))
    setEditOpen(false)
  }

  const handleDelete = async () => {
    await runAction('delete', () => deleteTask(message.id))
    setDeleteOpen(false)
  }

  return (
    <>
      <div
        className={cn(
          'min-w-[240px] space-y-2 rounded-lg border p-3 text-foreground',
          status === 'accepted' &&
            'border-emerald-500/40 bg-emerald-500/10',
          status === 'canceled' &&
            'border-border/40 bg-muted/50 opacity-80',
          status === 'disputed' &&
            'border-amber-500/40 bg-amber-500/10',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2 text-sm font-medium">
            <ListTodo className="mt-0.5 h-4 w-4 shrink-0 text-[var(--davinci-beam)]" />
            <div className="min-w-0 whitespace-pre-wrap">{title}</div>
          </div>
          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            {t(`status.${status}`)}
          </span>
        </div>

        {bodyAfterTitle ? (
          <p className="whitespace-pre-wrap text-xs text-muted-foreground">{bodyAfterTitle}</p>
        ) : null}

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {deadlineLabel ? <span>{deadlineLabel}</span> : null}
          {budgetLabel ? <span>{t('budgetLabel', { value: budgetLabel })}</span> : null}
          {task.escrow?.enabled ? (
            <span>{t('escrowLabel', { status: task.escrow.paymentStatus })}</span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {canStart ? (
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              disabled={Boolean(busy)}
              onClick={() => void runAction('start', () => startTask(message.id))}
            >
              {busy === 'start' ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              {t('start')}
            </Button>
          ) : null}
          {canRequest ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={Boolean(busy)}
              onClick={() => void runAction('request', () => requestTask(message.id))}
            >
              {busy === 'request' ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              {t('request')}
            </Button>
          ) : null}
          {canApprove ? (
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              disabled={Boolean(busy)}
              onClick={() => void runAction('approve', () => approveTaskRequest(message.id))}
            >
              {t('approve')}
            </Button>
          ) : null}
          {canReject ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={Boolean(busy)}
              onClick={() => void runAction('reject', () => rejectTaskRequest(message.id))}
            >
              {t('reject')}
            </Button>
          ) : null}
          {canComplete ? (
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              disabled={Boolean(busy)}
              onClick={() => void runAction('complete', () => completeTask(message.id))}
            >
              {t('done')}
            </Button>
          ) : null}
          {canAccept ? (
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              disabled={Boolean(busy)}
              onClick={() => void runAction('accept', () => acceptTask(message.id))}
            >
              {t('accept')}
            </Button>
          ) : null}
          {canDispute ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={Boolean(busy)}
              onClick={() => void runAction('dispute', () => disputeTask(message.id))}
            >
              {t('dispute')}
            </Button>
          ) : null}
          {canConvert ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={Boolean(busy)}
              onClick={() =>
                void runAction('convert', () => convertTaskToOpportunity(message.id))
              }
            >
              {t('convert')}
            </Button>
          ) : null}
          {task.opportunityId ? (
            <span className="self-center text-[11px] text-muted-foreground">
              {t('converted')}
            </span>
          ) : null}
          {canCancel ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              disabled={Boolean(busy)}
              onClick={() => void runAction('cancel', () => cancelTask(message.id))}
            >
              {t('cancel')}
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={() => {
                setEditContent(message.content)
                setEditOpen(true)
              }}
            >
              <Pencil className="mr-1 h-3 w-3" />
              {t('edit')}
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              {t('delete')}
            </Button>
          ) : null}
        </div>
      </div>

      <AlertDialog open={editOpen} onOpenChange={setEditOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('editTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('descriptionPlaceholder')}</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={5}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === 'edit'}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy === 'edit'}
              onClick={(e) => {
                e.preventDefault()
                void handleEditSave()
              }}
            >
              {busy === 'edit' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('save')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteConfirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === 'delete'}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy === 'delete'}
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default TaskMessageWidget
