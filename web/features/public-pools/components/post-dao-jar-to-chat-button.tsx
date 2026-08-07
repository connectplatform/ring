'use client'

import { useMemo, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2, PiggyBank } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ContactPicker, type ContactPickerSelection } from '@/components/contacts'
import { postDaoJarToContacts } from '@/app/_actions/dao-jar'
import { toast } from '@/hooks/use-toast'
import type { Locale } from '@/i18n/shared'
import { cn } from '@/lib/utils'

function selectionUserId(selection: ContactPickerSelection): string | null {
  if (selection.kind === 'user') return selection.user.id
  return selection.contact.contactUserId || null
}

export interface PostDaoJarToChatButtonProps {
  poolSlug: string
  className?: string
}

/** Posts a live dao_jar funding card (not share_card link) into selected DMs. */
export function PostDaoJarToChatButton({
  poolSlug,
  className,
}: PostDaoJarToChatButtonProps) {
  const locale = useLocale() as Locale
  const t = useTranslations('modules.dao')
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
        const result = await postDaoJarToContacts({ poolSlug, contactUserIds })
        if (!result.success) {
          toast({ title: result.error ?? t('postJarFailed'), variant: 'destructive' })
          return
        }
        toast({ title: result.message ?? t('postJarSuccess') })
        setOpen(false)
      })
    },
    [poolSlug, t, tMessenger],
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
          <PiggyBank className="h-3.5 w-3.5" aria-hidden />
        )}
        {t('postJarToChat')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('postJarPickContacts')}</DialogTitle>
          </DialogHeader>
          <ContactPicker
            locale={locale}
            mode="message"
            selectionMode="multiple"
            onSelect={() => {}}
            onConfirmMultiple={onConfirmMultiple}
            confirmLabel={t('postJarConfirm')}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

export default PostDaoJarToChatButton
