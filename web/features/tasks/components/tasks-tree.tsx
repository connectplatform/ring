'use client'

import { useCallback, useEffect, useState } from 'react'
import { Link, toAppHref } from '@/i18n/routing'
import { useLocale, useTranslations } from 'next-intl'
import { ListTodo, Loader2, MessageCircle } from 'lucide-react'
import type { Message } from '@/features/chat/types'
import type { TaskConversationGroup, TaskTreeFilter } from '@/features/tasks/services/task-query-service'
import {
  formatTaskDeadlineI18n,
  parseTaskMetadata,
  taskTitleFromContent,
} from '@/features/tasks/types'
import { ROUTES } from '@/constants/routes'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Locale } from '@/i18n/shared'

const FILTERS: TaskTreeFilter[] = ['all', 'available', 'in_progress', 'completed']

function TaskRow({ task, chatId, locale }: { task: Message; chatId: string; locale: Locale }) {
  const t = useTranslations('modules.tasks')
  const meta = parseTaskMetadata(task)
  if (!meta) return null

  const title = taskTitleFromContent(task.content)
  const deadlineLabel = formatTaskDeadlineI18n(meta.deadline, t)

  return (
    <div className="rounded-lg border bg-card/50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-wrap text-sm font-medium">{title}</p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="rounded-md bg-muted px-1.5 py-0.5 font-semibold uppercase tracking-wide">
              {t(`status.${meta.status}`)}
            </span>
            {deadlineLabel ? <span>{deadlineLabel}</span> : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" className="h-8 text-xs">
            <Link href={toAppHref(ROUTES.TASK(chatId, locale))}>{t('tree.viewAll')}</Link>
          </Button>
          <Button asChild size="sm" variant="ghost" className="h-8 text-xs">
            <Link
              href={toAppHref(
                `${ROUTES.MESSAGES(locale)}?c=${encodeURIComponent(chatId)}`,
              )}
            >
              <MessageCircle className="mr-1 h-3 w-3" />
              {t('tree.openChat')}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

export function TasksTree({ initialFilter = 'all' }: { initialFilter?: TaskTreeFilter }) {
  const locale = useLocale() as Locale
  const t = useTranslations('modules.tasks')
  const [filter, setFilter] = useState<TaskTreeFilter>(initialFilter)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<TaskConversationGroup[]>([])

  const filterLabel = (id: TaskTreeFilter) => {
    switch (id) {
      case 'all':
        return t('tree.filterAll')
      case 'available':
        return t('tree.filterAvailable')
      case 'in_progress':
        return t('tree.filterInProgress')
      case 'completed':
        return t('tree.filterCompleted')
      default:
        return id
    }
  }

  const load = useCallback(async (nextFilter: TaskTreeFilter) => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/tasks?filter=${encodeURIComponent(nextFilter)}`, {
        cache: 'no-store',
      })
      const payload = (await response.json()) as {
        conversations?: TaskConversationGroup[]
        error?: string
      }
      if (!response.ok) {
        throw new Error(payload.error || t('actionFailed'))
      }
      setGroups(payload.conversations ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : t('actionFailed'))
      setGroups([])
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load(filter)
  }, [filter, load])

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <ListTodo className="h-6 w-6 text-[var(--davinci-beam)]" />
        <div>
          <h1 className="text-2xl font-semibold">{t('tree.title')}</h1>
          <p className="text-sm text-muted-foreground">
            Up to 3 recent tasks per chat, 21 total across your conversations.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((id) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={filter === id ? 'default' : 'outline'}
            className={cn('h-8 text-xs', filter === id && 'shadow-sm')}
            onClick={() => setFilter(id)}
          >
            {filterLabel(id)}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('tree.loading')}
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!loading && !error && groups.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t('tree.empty')}
        </div>
      ) : null}

      {!loading && !error
        ? groups.map((group) => (
            <section key={group.conversationId} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">{group.title}</h2>
                <Link
                  href={toAppHref(ROUTES.TASK(group.conversationId, locale))}
                  className="text-xs text-primary hover:underline"
                >
                  {t('tree.viewAll')}
                </Link>
              </div>
              <div className="space-y-2">
                {group.tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    chatId={group.conversationId}
                    locale={locale}
                  />
                ))}
              </div>
            </section>
          ))
        : null}
    </div>
  )
}

export default TasksTree
