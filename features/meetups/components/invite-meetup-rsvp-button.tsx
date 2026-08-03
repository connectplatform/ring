'use client'

import { useMemo, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CalendarDays, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ContactPicker, type ContactPickerSelection } from '@/components/contacts'
import { createRsvpToContacts } from '@/app/_actions/chat-rsvp'
import { toast } from '@/hooks/use-toast'
import type { Locale } from '@/i18n/shared'
import { cn } from '@/lib/utils'

function selectionUserId(selection: ContactPickerSelection): string | null {
  if (selection.kind === 'user') return selection.user.id
  return selection.contact.contactUserId || null
}

export interface InviteMeetupRsvpButtonProps {
  meetupId: string
  title: string
  startsAt?: string
  locationLabel?: string
  className?: string
}

/** TD-UX-01 — Invite contacts to an RSVP bound to a meetup. */
export function InviteMeetupRsvpButton({
  meetupId,
  title,
  startsAt,
  locationLabel,
  className,
}: InviteMeetupRsvpButtonProps) {
  const locale = useLocale() as Locale
  const t = useTranslations('meetups')
  const tMessenger = useTranslations('modules.messenger')
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const onConfirmMultiple = useMemo(
    () => (selections: ContactPickerSelection[]) => {
      const contactUserIds = selections
        .map(selectionUserId)
        .filter((id): id is string => Boolean(id))
      if (contactUserIds.length === 0) {
        toast({ title: tMessenger('shareNoContacts'), variant: 'destructive' })
        return
      }
      startTransition(async () => {
        const result = await createRsvpToContacts({
          title,
          binding: { targetType: 'meetup', targetId: meetupId },
          startsAt,
          locationLabel,
          contactUserIds,
        })
        if (!result.success) {
          toast({ title: result.error ?? t('inviteRsvpFailed'), variant: 'destructive' })
          return
        }
        toast({ title: result.message ?? t('inviteRsvpSuccess') })
        setOpen(false)
      })
    },
    [meetupId, title, startsAt, locationLabel, t, tMessenger],
  )

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className={cn('h-8 gap-1 text-xs', className)}
        onClick={() => setOpen(true)}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
        )}
        {t('inviteRsvp')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('inviteRsvpPickContacts')}</DialogTitle>
          </DialogHeader>
          <ContactPicker
            locale={locale}
            mode="message"
            selectionMode="multiple"
            onSelect={() => {}}
            onConfirmMultiple={onConfirmMultiple}
            confirmLabel={t('inviteRsvpConfirm')}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

export default InviteMeetupRsvpButton
