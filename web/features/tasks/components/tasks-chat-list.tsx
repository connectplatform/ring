'use client'

import { Link, toAppHref } from '@/i18n/routing'
import { useLocale, useTranslations } from 'next-intl'
import { ListTodo, MessageCircle } from 'lucide-react'
import type { Message } from '@/features/chat/types'
import {
  formatTaskBudget,
  formatTaskDeadlineI18n,
  parseTaskMetadata,
  taskTitleFromContent,
} from '@/features/tasks/types'
import { ROUTES } from '@/constants/routes'
import { Button } from '@/components/ui/button'
import type { Locale } from '@/i18n/shared'

export interface TasksChatListProps {
  conversationId: string
  conversationTitle: string
  tasks: Message[]
}

export function TasksChatList({
  conversationId,
  conversationTitle,
  tasks,
}: TasksChatListProps) {
  const locale = useLocale() as Locale
  const t = useTranslations('modules.tasks')

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <ListTodo className="mt-1 h-6 w-6 text-[var(--davinci-beam)]" />
          <div>
            <h1 className="text-2xl font-semibold">{conversationTitle}</h1>
            <p className="text-sm text-muted-foreground">{t('chatList.title')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={toAppHref(ROUTES.TASKS(locale))}>{t('chatList.back')}</Link>
          </Button>
          <Button asChild size="sm">
            <Link
              href={toAppHref(
                `${ROUTES.MESSAGES(locale)}?c=${encodeURIComponent(conversationId)}`,
              )}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              {t('tree.openChat')}
            </Link>
          </Button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t('chatList.empty')}
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const meta = parseTaskMetadata(task)
            if (!meta) return null

            const title = taskTitleFromContent(task.content)
            const deadlineLabel = formatTaskDeadlineI18n(meta.deadline, t)
            const budgetLabel = formatTaskBudget(meta.budget)

            return (
              <article key={task.id} className="rounded-lg border bg-card/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap text-sm font-medium">{title}</p>
                    {task.content !== title ? (
                      <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                        {task.content}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                    {t(`status.${meta.status}`)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  {deadlineLabel ? <span>{deadlineLabel}</span> : null}
                  {budgetLabel ? <span>{t('budgetLabel', { value: budgetLabel })}</span> : null}
                  {meta.escrow?.enabled ? (
                    <span>{t('escrowLabel', { status: meta.escrow.paymentStatus })}</span>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default TasksChatList
