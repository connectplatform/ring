'use client'

import { useState, useTransition } from 'react'
import { CalendarDays, Loader2 } from 'lucide-react'
import type { Message, RsvpMetadata } from '@/features/chat/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { respondRsvp } from '@/app/_actions/chat-rsvp'

type RsvpChoice = 'going' | 'maybe' | 'declined'

function parseRsvp(message: Message): RsvpMetadata | null {
  const meta = message.metadata
  if (!meta || meta.kind !== 'rsvp') return null
  if (typeof meta.title !== 'string') return null
  return meta as unknown as RsvpMetadata
}

function countChoice(responses: Record<string, RsvpChoice>, choice: RsvpChoice): number {
  return Object.values(responses).filter((v) => v === choice).length
}

export interface RsvpMessageWidgetProps {
  message: Message
  isOwn: boolean
  currentUserId?: string
  className?: string
}

export function RsvpMessageWidget({
  message,
  currentUserId,
  className,
}: RsvpMessageWidgetProps) {
  const base = parseRsvp(message)
  const [local, setLocal] = useState<RsvpMetadata | null>(null)
  const [pending, startTransition] = useTransition()
  const rsvp = local ?? base

  if (!rsvp) {
    return <div className="whitespace-pre-wrap">{message.content}</div>
  }

  const isOpen = rsvp.status === 'open'
  const mine = currentUserId ? rsvp.responses[currentUserId] : undefined

  const onRespond = (choice: RsvpChoice) => {
    if (!isOpen || !currentUserId || pending) return
    startTransition(async () => {
      const result = await respondRsvp({ messageId: message.id, response: choice })
      if (!result.success) {
        toast({ title: result.error ?? 'RSVP failed', variant: 'destructive' })
        return
      }
      if (result.data?.metadata) {
        setLocal(result.data.metadata as unknown as RsvpMetadata)
      }
    })
  }

  const choices: Array<{ id: RsvpChoice; label: string }> = [
    { id: 'going', label: 'Going' },
    { id: 'maybe', label: 'Maybe' },
    { id: 'declined', label: 'Decline' },
  ]

  return (
    <div
      className={cn(
        'min-w-[240px] space-y-2 rounded-md border border-border/50 bg-background/40 p-3',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 opacity-80" aria-hidden />
        <div className="space-y-0.5">
          <p className="text-sm font-medium leading-snug">{rsvp.title}</p>
          {rsvp.startsAt ? (
            <p className="text-[11px] opacity-70">
              {new Date(rsvp.startsAt).toLocaleString()}
            </p>
          ) : null}
          {rsvp.locationLabel ? (
            <p className="text-[11px] opacity-70">{rsvp.locationLabel}</p>
          ) : null}
          <p className="text-[11px] opacity-70">
            {countChoice(rsvp.responses, 'going')} going ·{' '}
            {countChoice(rsvp.responses, 'maybe')} maybe ·{' '}
            {countChoice(rsvp.responses, 'declined')} declined
          </p>
        </div>
      </div>

      {isOpen && currentUserId ? (
        <div className="flex flex-wrap gap-1.5">
          {choices.map((c) => (
            <Button
              key={c.id}
              type="button"
              size="sm"
              variant={mine === c.id ? 'default' : 'outline'}
              className="h-7 text-xs"
              disabled={pending}
              onClick={() => onRespond(c.id)}
            >
              {pending && mine === c.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                c.label
              )}
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-[11px] opacity-70">
          {isOpen ? 'Sign in to respond' : `RSVP ${rsvp.status}`}
        </p>
      )}
    </div>
  )
}

export default RsvpMessageWidget
