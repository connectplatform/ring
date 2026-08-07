'use client'

import { useMemo, useState, useTransition } from 'react'
import { BarChart3, Loader2 } from 'lucide-react'
import type { Message, PollMetadata } from '@/features/chat/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { castPollVote, closePoll } from '@/app/_actions/chat-poll'

function parsePoll(message: Message): PollMetadata | null {
  const meta = message.metadata
  if (!meta || meta.kind !== 'poll') return null
  if (typeof meta.question !== 'string' || !Array.isArray(meta.options)) return null
  return meta as unknown as PollMetadata
}

function tally(votes: Record<string, string[]>, optionId: string): number {
  let n = 0
  for (const ids of Object.values(votes)) {
    if (ids.includes(optionId)) n += 1
  }
  return n
}

export interface PollMessageWidgetProps {
  message: Message
  isOwn: boolean
  currentUserId?: string
  className?: string
}

export function PollMessageWidget({
  message,
  isOwn,
  currentUserId,
  className,
}: PollMessageWidgetProps) {
  const base = parsePoll(message)
  const [local, setLocal] = useState<PollMetadata | null>(null)
  const [pending, startTransition] = useTransition()
  const poll = local ?? base

  const myVotes = useMemo(() => {
    if (!poll || !currentUserId) return [] as string[]
    return poll.votes[currentUserId] ?? []
  }, [poll, currentUserId])

  if (!poll) {
    return <div className="whitespace-pre-wrap">{message.content}</div>
  }

  const isOpen = poll.status === 'open'
  const totalVoters = Object.keys(poll.votes).length

  const onVote = (optionId: string) => {
    if (!isOpen || !currentUserId || pending) return
    startTransition(async () => {
      const next = poll.allowMultiple
        ? myVotes.includes(optionId)
          ? myVotes.filter((id) => id !== optionId)
          : [...myVotes, optionId]
        : [optionId]

      const result = await castPollVote({ messageId: message.id, optionIds: next })
      if (!result.success) {
        toast({ title: result.error ?? 'Vote failed', variant: 'destructive' })
        return
      }
      if (result.data?.metadata) {
        setLocal(result.data.metadata as unknown as PollMetadata)
      }
    })
  }

  const onClose = () => {
    startTransition(async () => {
      const result = await closePoll({ messageId: message.id })
      if (!result.success) {
        toast({ title: result.error ?? 'Close failed', variant: 'destructive' })
        return
      }
      if (result.data?.metadata) {
        setLocal(result.data.metadata as unknown as PollMetadata)
      }
    })
  }

  return (
    <div
      className={cn(
        'min-w-[240px] space-y-2 rounded-md border border-border/50 bg-background/40 p-3',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 opacity-80" aria-hidden />
        <div className="space-y-0.5">
          <p className="text-sm font-medium leading-snug">{poll.question}</p>
          <p className="text-[11px] opacity-70">
            {isOpen ? 'Open' : poll.status} · {totalVoters} vote{totalVoters === 1 ? '' : 's'}
            {poll.allowMultiple ? ' · multi' : ''}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        {poll.options.map((opt) => {
          const count = tally(poll.votes, opt.id)
          const selected = myVotes.includes(opt.id)
          const pct = totalVoters > 0 ? Math.round((count / totalVoters) * 100) : 0
          return (
            <button
              key={opt.id}
              type="button"
              disabled={!isOpen || !currentUserId || pending}
              onClick={() => onVote(opt.id)}
              className={cn(
                'relative w-full overflow-hidden rounded-md border px-2 py-1.5 text-left text-xs transition-colors',
                selected
                  ? 'border-primary/60 bg-primary/10'
                  : 'border-border/60 bg-muted/20 hover:bg-muted/40',
                (!isOpen || !currentUserId) && 'cursor-default opacity-90',
              )}
            >
              <span
                className="pointer-events-none absolute inset-y-0 left-0 bg-primary/15"
                style={{ width: `${pct}%` }}
                aria-hidden
              />
              <span className="relative flex items-center justify-between gap-2">
                <span>{opt.label}</span>
                <span className="tabular-nums opacity-70">
                  {count}
                  {!isOpen || totalVoters > 0 ? ` · ${pct}%` : ''}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {isOwn && isOpen ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={pending}
          onClick={onClose}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Close poll'}
        </Button>
      ) : null}
    </div>
  )
}

export default PollMessageWidget
