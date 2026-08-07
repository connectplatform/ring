import type { Message, TaskMetadata, TaskStatus } from '@/features/chat/types'
import {
  getClientCreditUnitLabel,
  getClientMainCurrency,
  getClientNativeTokenSymbol,
} from '@/lib/ring-config-client'

export type { TaskMetadata, TaskStatus }

export function parseTaskMetadata(message: Message): TaskMetadata | null {
  const meta = message.metadata
  if (meta && meta.kind === 'task' && typeof meta.reporterUserId === 'string') {
    return meta as unknown as TaskMetadata
  }
  if (message.type !== 'task') return null
  return {
    kind: 'task',
    reporterUserId: message.senderId,
    assigneeUserId: null,
    status: 'available',
  }
}

export function taskTitleFromContent(content: string): string {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return 'Task'
  if (lines.length === 1) return lines[0]
  return `${lines[0]}\n${lines[1]}`
}

export function taskFirstLine(content: string): string {
  const line = content.split('\n')[0]?.trim()
  return line || 'Task'
}

export function taskFallbackContent(content: string): string {
  return `Task: ${taskFirstLine(content)}`
}

export type TasksTranslateFn = (
  key: string,
  values?: Record<string, string | number>,
) => string

export function formatTaskDeadline(deadline?: string): string {
  if (!deadline) return ''
  const target = new Date(deadline)
  if (Number.isNaN(target.getTime())) return ''

  const now = Date.now()
  const diffMs = target.getTime() - now

  if (diffMs <= 0) {
    return `Expired ${target.toLocaleString()}`
  }

  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffDays >= 1) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} left`
  }
  if (diffHours >= 1) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} left`
  }
  if (diffMins >= 1) {
    return `${diffMins} min left`
  }
  return 'Due soon'
}

/** Localized deadline label; pass `t` from `useTranslations('modules.tasks')`. */
export function formatTaskDeadlineI18n(
  deadline: string | undefined,
  t: TasksTranslateFn,
): string {
  if (!deadline) return ''
  const target = new Date(deadline)
  if (Number.isNaN(target.getTime())) return ''

  const now = Date.now()
  const diffMs = target.getTime() - now

  if (diffMs <= 0) {
    return t('deadlineRemaining.expired', { when: target.toLocaleString() })
  }

  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffDays >= 1) {
    return t(diffDays === 1 ? 'deadlineRemaining.days' : 'deadlineRemaining.days_plural', {
      count: diffDays,
    })
  }
  if (diffHours >= 1) {
    return t(
      diffHours === 1 ? 'deadlineRemaining.hours' : 'deadlineRemaining.hours_plural',
      { count: diffHours },
    )
  }
  if (diffMins >= 1) {
    return t('deadlineRemaining.minutes', { count: diffMins })
  }
  return t('deadlineRemaining.dueSoon')
}

export function formatTaskBudget(budget: TaskMetadata['budget']): string | null {
  if (!budget || !Number.isFinite(budget.amount)) return null
  const code = budget.currencyCode?.trim()
  switch (budget.displayUnit) {
    case 'credit_balance':
      return `${budget.amount} ${getClientCreditUnitLabel()}`
    case 'native_token':
      return code ? `${budget.amount} ${code}` : `${budget.amount} ${getClientNativeTokenSymbol()}`
    case 'main_currency':
      return code ? `${budget.amount} ${code}` : `${budget.amount} ${getClientMainCurrency()}`
    default:
      return `${budget.amount} ${getClientMainCurrency()}`
  }
}

export function isEscrowLocked(meta: TaskMetadata): boolean {
  const ps = meta.escrow?.paymentStatus ?? 'none'
  return ps === 'held' || ps === 'released'
}

export function canEditTask(meta: TaskMetadata): boolean {
  if (meta.status !== 'available') return false
  return !isEscrowLocked(meta)
}

export function canDeleteTask(meta: TaskMetadata, userId: string): boolean {
  if (meta.reporterUserId !== userId) return false
  if (!['available', 'requested', 'canceled'].includes(meta.status)) return false
  const ps = meta.escrow?.paymentStatus ?? 'none'
  return ps === 'none' || ps === 'refunded' || ps === 'failed'
}

export function taskStatusLabel(status: TaskStatus): string {
  switch (status) {
    case 'available':
      return 'Available'
    case 'requested':
      return 'Requested'
    case 'in_progress':
      return 'In progress'
    case 'completed':
      return 'Completed'
    case 'accepted':
      return 'Accepted'
    case 'canceled':
      return 'Canceled'
    case 'disputed':
      return 'Disputed'
    default:
      return status
  }
}
