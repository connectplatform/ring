'use client'

import React, { useCallback, useEffect, useState, startTransition } from 'react'
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  MessageCircle,
  User as UserIcon,
  Mail,
  Send,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useLocale } from 'next-intl'
import { useSession } from 'next-auth/react'
import type { Locale } from '@/i18n/shared'
import { EmbeddedConversation } from '@/features/chat/components/embedded-conversation'

export interface CrmTaskRow {
  id: string
  threadId: string
  title: string
  description?: string | null
  status: string
  priority: string
  taskType: string
  triggerReason?: string | null
  dueDate: string | null
  createdAt?: string | null
}

type TaskDetail = {
  task: CrmTaskRow & { description?: string | null; triggerReason?: string | null }
  thread: {
    subject?: string
    fromEmail?: string
    fromName?: string | null
    status?: string
    sentiment?: string
    intent?: string
    preferChat?: boolean
    supportConversationId?: string | null
    routeFlag?: string | null
    unsubscribeUrl?: string | null
    lastUnsubscribeRequest?: { at: string; by: string; url: string } | null
  } | null
  messages: Array<{
    id: string
    direction?: string
    isInbound?: boolean
    fromEmail?: string
    bodyText?: string | null
    subject?: string
    createdAt?: string
    date?: string
  }>
  contact: {
    id: string
    email: string
    name: string | null
    type: string
    tags: string[]
    ringUserId: string | null
    totalInteractions: number
    sentimentHistory?: Array<{ sentiment: string; score: number }>
  } | null
  user: {
    id: string
    name: string | null
    email: string | null
    image: string | null
    role: string | null
  } | null
  supportConversation: {
    id: string
    preferChat?: boolean
    messages: Array<{
      id: string
      content: string
      senderName: string
      timestamp: string | Date
    }>
  } | null
  sentiment: string | null
  preferChat: boolean
}

const COLLAPSED_H = 'min-h-[3.25rem] h-[3.25rem]'

function priorityVariant(p: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (p === 'urgent' || p === 'high') return 'destructive'
  if (p === 'low') return 'outline'
  return 'secondary'
}

function TaskCollapsedRow({
  task,
  active,
  onExpand,
  onComplete,
}: {
  task: CrmTaskRow
  active?: boolean
  onExpand: () => void
  onComplete?: () => void
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-between gap-3 border border-border/60 bg-[hsl(var(--app-panel))] px-3',
        COLLAPSED_H,
        active && 'border-primary/40 ring-1 ring-primary/20',
      )}
    >
      <button
        type="button"
        onClick={onExpand}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <Mail className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium text-foreground">{task.title}</span>
        <Badge variant={priorityVariant(task.priority)} className="shrink-0 text-[10px]">
          {task.priority}
        </Badge>
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
          {task.status} · {task.taskType}
        </span>
        {task.dueDate && (
          <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground md:flex">
            <Clock className="size-3" />
            {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
      </button>
      <div className="flex shrink-0 items-center gap-1">
        {task.status !== 'completed' && onComplete && (
          <Button type="button" size="sm" variant="ghost" onClick={onComplete} className="h-8 px-2">
            <CheckCircle className="size-4 text-green-600" />
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" onClick={onExpand} className="h-8 px-2">
          {active ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </Button>
      </div>
    </div>
  )
}

function EmailReplyPanel({
  taskId,
  toEmail,
  subject,
  onSent,
}: {
  taskId: string
  toEmail?: string
  subject?: string
  onSent: () => void
}) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    if (!text.trim() || sending) return
    setSending(true)
    setNotice(null)
    setError(null)
    try {
      const res = await fetch(`/api/admin/email/tasks/${taskId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), toEmail, subject }),
      })
      const json = await res.json()
      if (json.skipped) {
        setNotice(json.notice || 'Email skipped — client prefers chat.')
        return
      }
      if (!res.ok) throw new Error(json.error || 'Send failed')
      setText('')
      setNotice('Email sent.')
      onSent()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="space-y-2 rounded-md border border-border/50 p-3">
      <h3 className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Mail className="size-3.5" />
        Email reply
        {toEmail ? <span className="font-normal normal-case">→ {toEmail}</span> : null}
      </h3>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="Write a reply…"
        className="text-sm"
      />
      {notice && <p className="text-xs text-amber-700 dark:text-amber-400">{notice}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="button" size="sm" disabled={sending || !text.trim()} onClick={send}>
        {sending ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Send className="mr-1 size-4" />}
        Send email
      </Button>
    </section>
  )
}

function TaskExpandedBody({
  detail,
  loading,
  error,
  onCollapse,
  onComplete,
  onRefresh,
  locale,
  userId,
}: {
  detail: TaskDetail | null
  loading: boolean
  error: string | null
  onCollapse: () => void
  onComplete: () => void
  onRefresh: () => void
  locale: Locale
  userId?: string
}) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Loading task…
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-destructive">{error || 'Failed to load task'}</p>
        <Button type="button" variant="outline" size="sm" onClick={onCollapse}>
          Collapse
        </Button>
      </div>
    )
  }

  const { task, contact, user, supportConversation, messages, thread, sentiment, preferChat } =
    detail
  const supportId = supportConversation?.id
  const showEmailCompose = !preferChat

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-primary/30 bg-[hsl(var(--app-panel))]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{task.title}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {task.status} · {task.priority} · {task.taskType}
            {sentiment ? ` · sentiment: ${sentiment}` : ''}
            {preferChat ? ' · chat preferred' : ''}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          {task.status !== 'completed' && (
            <Button type="button" size="sm" onClick={onComplete}>
              <CheckCircle className="mr-1 size-4" />
              Complete
            </Button>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={onCollapse}>
            <ChevronUp className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-h-0 flex-col gap-3 overflow-hidden p-4">
          {task.description && (
            <section className="shrink-0">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Inquiry
              </h3>
              <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed">
                {task.description}
              </p>
            </section>
          )}

          {supportId && userId ? (
            <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border/50">
              <EmbeddedConversation
                conversationId={supportId}
                userId={userId}
                variant="support"
                preferChat={preferChat}
                className="min-h-[16rem]"
                headerExtra={
                  <a
                    href={`/${locale}/messages?c=${encodeURIComponent(supportId)}`}
                    className="text-primary hover:underline"
                  >
                    Open in Messages →
                  </a>
                }
              />
            </section>
          ) : supportConversation && supportConversation.messages.length > 0 ? (
            <section className="shrink-0">
              <h3 className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <MessageCircle className="size-3.5" />
                Support chat
              </h3>
              <div className="space-y-2 rounded-md border border-border/50 bg-muted/20 p-3">
                {supportConversation.messages.map((m) => (
                  <div key={m.id} className="text-sm">
                    <span className="font-medium">{m.senderName}: </span>
                    <span className="text-muted-foreground">{m.content}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {showEmailCompose && (
            <div className="shrink-0">
              <EmailReplyPanel
                taskId={task.id}
                toEmail={thread?.fromEmail || contact?.email || undefined}
                subject={thread?.subject || task.title}
                onSent={onRefresh}
              />
            </div>
          )}

          {!supportId && messages.length > 0 && (
            <section className="min-h-0 shrink overflow-y-auto">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Email thread
              </h3>
              <div className="space-y-2">
                {messages.map((m) => (
                  <div key={m.id} className="rounded-md border border-border/40 p-2 text-sm">
                    <div className="text-xs text-muted-foreground">
                      {m.isInbound === false ? 'outbound' : m.direction || 'inbound'} ·{' '}
                      {m.fromEmail || thread?.fromEmail}
                    </div>
                    <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-muted-foreground">
                      {m.bodyText || m.subject || '—'}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!task.description && messages.length === 0 && !supportConversation && (
            <p className="text-sm text-muted-foreground">No thread content yet.</p>
          )}
        </div>

        <aside className="min-h-0 overflow-y-auto border-t border-border/50 p-4 lg:border-l lg:border-t-0">
          <h3 className="mb-3 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <UserIcon className="size-3.5" />
            {user ? 'Ring user' : 'Contact'}
          </h3>
          {user ? (
            <div className="space-y-2 text-sm">
              <div className="font-medium">{user.name || 'Member'}</div>
              <div className="text-muted-foreground">{user.email}</div>
              {user.role && (
                <Badge variant="outline" className="text-[10px]">
                  {user.role}
                </Badge>
              )}
              <p className="break-all font-mono text-xs text-muted-foreground">{user.id}</p>
            </div>
          ) : contact ? (
            <div className="space-y-2 text-sm">
              <div className="font-medium">{contact.name || 'Unknown'}</div>
              <div className="text-muted-foreground">{contact.email}</div>
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary" className="text-[10px]">
                  {contact.type}
                </Badge>
                {contact.tags?.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {contact.totalInteractions} interaction
                {contact.totalInteractions === 1 ? '' : 's'}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No contact linked.</p>
          )}

          {thread && (
            <div className="mt-4 space-y-1 border-t border-border/40 pt-3 text-xs text-muted-foreground">
              <div>Thread: {thread.status || '—'}</div>
              {thread.intent && <div>Intent: {thread.intent}</div>}
              {thread.fromEmail && <div>From: {thread.fromEmail}</div>}
              <div className="break-all font-mono text-[10px] opacity-70">{task.threadId}</div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

export function CrmTasksClient({ initialTasks = [] }: { initialTasks?: CrmTaskRow[] }) {
  const locale = (useLocale() as Locale) || 'en'
  const { data: session } = useSession()
  const userId = session?.user?.id
  const [tasks, setTasks] = useState<CrmTaskRow[]>(initialTasks)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<TaskDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [chip, setChip] = useState<'all' | 'lead' | 'osint' | 'unsubscribe'>('all')
  const deepLinkHandled = React.useRef(false)

  const load = useCallback(async () => {
    const qs = chip === 'all' ? '' : `?chip=${chip}`
    const res = await fetch(`/api/admin/email/tasks${qs}`, { cache: 'no-store' })
    if (!res.ok) return [] as CrmTaskRow[]
    const json = await res.json()
    const mapped = (json.tasks ?? []).map((t: Record<string, unknown>) => ({
      id: String(t.id),
      threadId: String(t.threadId),
      title: String(t.title),
      description: t.description ? String(t.description) : null,
      status: String(t.status),
      priority: String(t.priority),
      taskType: String(t.taskType),
      triggerReason: t.triggerReason ? String(t.triggerReason) : null,
      dueDate: t.dueDate ? String(t.dueDate) : null,
      createdAt: t.createdAt ? String(t.createdAt) : null,
    })) as CrmTaskRow[]
    setTasks(mapped)
    return mapped
  }, [chip])

  const fetchDetail = useCallback(async (id: string) => {
    setLoadingDetail(true)
    setDetailError(null)
    try {
      const res = await fetch(`/api/admin/email/tasks/${id}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load')
      setDetail(json as TaskDetail)
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  useEffect(() => {
    void load().then((mapped) => {
      if (deepLinkHandled.current || typeof window === 'undefined') return
      const taskId = new URLSearchParams(window.location.search).get('taskId')
      if (!taskId || !mapped.some((t) => t.id === taskId)) return
      deepLinkHandled.current = true
      startTransition(() => setExpandedId(taskId))
      void fetchDetail(taskId)
    })
  }, [load, fetchDetail])

  const expand = (id: string) => {
    startTransition(() => {
      setExpandedId(id)
    })
    setDetail(null)
    void fetchDetail(id)
  }

  const collapse = () => {
    setExpandedId(null)
    setDetail(null)
    setDetailError(null)
  }

  const complete = async (id: string) => {
    await fetch(`/api/admin/email/tasks/${id}/complete`, { method: 'POST' })
    await load()
    if (expandedId === id) collapse()
  }

  const expandedIndex = expandedId ? tasks.findIndex((t) => t.id === expandedId) : -1
  const prevTask = expandedIndex > 0 ? tasks[expandedIndex - 1] : null
  const nextTask =
    expandedIndex >= 0 && expandedIndex < tasks.length - 1 ? tasks[expandedIndex + 1] : null
  const expandedTask = expandedIndex >= 0 ? tasks[expandedIndex] : null

  const chipBar = (
    <div className="mb-3 flex flex-wrap gap-2">
      {([
        ['all', 'All'],
        ['lead', 'Lead'],
        ['osint', 'OSINT'],
        ['unsubscribe', 'Unsubscribe pending'],
      ] as const).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => setChip(id)}
          className={cn(
            'rounded-lg border px-3 py-1.5 text-sm transition-colors',
            chip === id
              ? 'border-indigo-600 bg-indigo-600 text-white'
              : 'border-border bg-background text-foreground'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )

  if (tasks.length === 0) {
    return (
      <div>
        {chipBar}
        <p className="text-muted-foreground">No tasks yet.</p>
      </div>
    )
  }

  if (expandedTask) {
    return (
      <div className="flex h-[calc(100dvh-11rem)] min-h-[28rem] flex-col gap-2">
        {prevTask ? (
          <TaskCollapsedRow
            task={prevTask}
            onExpand={() => expand(prevTask.id)}
            onComplete={() => complete(prevTask.id)}
          />
        ) : (
          <div className={cn(COLLAPSED_H, 'shrink-0')} aria-hidden />
        )}

        <TaskExpandedBody
          detail={detail}
          loading={loadingDetail}
          error={detailError}
          onCollapse={collapse}
          onComplete={() => complete(expandedTask.id)}
          onRefresh={() => void fetchDetail(expandedTask.id)}
          locale={locale}
          userId={userId}
        />

        {nextTask ? (
          <TaskCollapsedRow
            task={nextTask}
            onExpand={() => expand(nextTask.id)}
            onComplete={() => complete(nextTask.id)}
          />
        ) : (
          <div className={cn(COLLAPSED_H, 'shrink-0')} aria-hidden />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {chipBar}
      {tasks.map((task) => (
        <TaskCollapsedRow
          key={task.id}
          task={task}
          onExpand={() => expand(task.id)}
          onComplete={() => complete(task.id)}
        />
      ))}
    </div>
  )
}
