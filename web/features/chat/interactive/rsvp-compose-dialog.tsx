'use client'

import { useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Conversation, RsvpMetadata } from '@/features/chat/types'
import { createRsvpMessage } from '@/app/_actions/chat-rsvp'
import { toast } from '@/hooks/use-toast'

export interface RsvpComposeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversation: Conversation
}

type MeetupOption = { id: string; title: string; date_time?: string; location_name?: string }

function defaultBinding(conversation: Conversation): RsvpMetadata['binding'] | null {
  if (conversation.metadata.meetupId) {
    return { targetType: 'meetup', targetId: conversation.metadata.meetupId }
  }
  if (conversation.metadata.entityId) {
    return { targetType: 'entity', targetId: conversation.metadata.entityId }
  }
  if (conversation.type === 'group') {
    return { targetType: 'group', targetId: conversation.id }
  }
  if (conversation.metadata.opportunityId) {
    return {
      targetType: 'opportunity',
      targetId: conversation.metadata.opportunityId,
    }
  }
  return null
}

export function RsvpComposeDialog({
  open,
  onOpenChange,
  conversation,
}: RsvpComposeDialogProps) {
  const t = useTranslations('modules.messenger')
  const fixedBinding = defaultBinding(conversation)
  const [meetupOptions, setMeetupOptions] = useState<MeetupOption[]>([])
  const [selectedMeetupId, setSelectedMeetupId] = useState('')
  const [title, setTitle] = useState(
    conversation.metadata.entityName ||
      conversation.metadata.groupName ||
      conversation.metadata.opportunityName ||
      conversation.metadata.meetupName ||
      '',
  )
  const [startsAt, setStartsAt] = useState('')
  const [locationLabel, setLocationLabel] = useState('')
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open || fixedBinding) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/meetups?limit=30', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const list = (data.meetups ?? data.items ?? []) as MeetupOption[]
        if (!cancelled) setMeetupOptions(Array.isArray(list) ? list : [])
      } catch {
        // Meetup picker optional — compose can still fail with binding required
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, fixedBinding])

  useEffect(() => {
    if (!selectedMeetupId) return
    const meetup = meetupOptions.find((m) => m.id === selectedMeetupId)
    if (!meetup) return
    if (meetup.title) setTitle(meetup.title)
    if (meetup.date_time) {
      const d = new Date(meetup.date_time)
      if (Number.isFinite(d.getTime())) {
        // datetime-local expects local wall time without Z
        const pad = (n: number) => String(n).padStart(2, '0')
        setStartsAt(
          `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
        )
      }
    }
    if (meetup.location_name) setLocationLabel(meetup.location_name)
  }, [selectedMeetupId, meetupOptions])

  const binding: RsvpMetadata['binding'] | null =
    fixedBinding ??
    (selectedMeetupId
      ? { targetType: 'meetup', targetId: selectedMeetupId }
      : null)

  const onSubmit = () => {
    if (!binding) {
      toast({ title: t('rsvpBindingRequired'), variant: 'destructive' })
      return
    }
    startTransition(async () => {
      const result = await createRsvpMessage({
        conversationId: conversation.id,
        title: title.trim(),
        binding,
        startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
        locationLabel: locationLabel.trim() || undefined,
      })
      if (!result.success) {
        toast({ title: result.error ?? t('rsvpCreateFailed'), variant: 'destructive' })
        return
      }
      toast({ title: t('rsvpCreated') })
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('rsvpComposeTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!fixedBinding ? (
            <div className="space-y-1.5">
              <Label htmlFor="rsvp-meetup">{t('rsvpMeetup')}</Label>
              <select
                id="rsvp-meetup"
                value={selectedMeetupId}
                onChange={(e) => setSelectedMeetupId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">{t('rsvpMeetupPlaceholder')}</option>
                {meetupOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title || m.id}
                  </option>
                ))}
              </select>
              {!meetupOptions.length ? (
                <p className="text-[11px] text-muted-foreground">{t('rsvpMeetupEmpty')}</p>
              ) : null}
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="rsvp-title">{t('rsvpTitle')}</Label>
            <Input
              id="rsvp-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('rsvpTitlePlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rsvp-when">{t('rsvpWhen')}</Label>
            <Input
              id="rsvp-when"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rsvp-where">{t('rsvpWhere')}</Label>
            <Input
              id="rsvp-where"
              value={locationLabel}
              onChange={(e) => setLocationLabel(e.target.value)}
              placeholder={t('rsvpWherePlaceholder')}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('pollCancel')}
          </Button>
          <Button
            type="button"
            disabled={pending || !binding || !title.trim()}
            onClick={onSubmit}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('rsvpCreate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default RsvpComposeDialog
