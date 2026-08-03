'use client'

import { useMemo, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Share2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ContactPicker, type ContactPickerSelection } from '@/components/contacts'
import { shareToContacts } from '@/app/_actions/share-card'
import type { ShareCardMetadata } from '@/features/chat/types'
import { toast } from '@/hooks/use-toast'
import type { Locale } from '@/i18n/shared'
import { cn } from '@/lib/utils'

function selectionUserId(selection: ContactPickerSelection): string | null {
  if (selection.kind === 'user') return selection.user.id
  return selection.contact.contactUserId || null
}

export interface ShareToChatButtonProps {
  targetType: ShareCardMetadata['targetType']
  targetId: string
  title: string
  description?: string
  url?: string
  previewImage?: string
  className?: string
  size?: 'sm' | 'default'
  variant?: 'outline' | 'ghost' | 'secondary'
  label?: string
}

export function ShareToChatButton({
  targetType,
  targetId,
  title,
  description,
  url,
  previewImage,
  className,
  size = 'sm',
  variant = 'outline',
  label,
}: ShareToChatButtonProps) {
  const locale = useLocale() as Locale
  const t = useTranslations('modules.messenger')
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const shareLabel = label ?? t('shareToChat')

  const onConfirmMultiple = useMemo(
    () => (selections: ContactPickerSelection[]) => {
      const contactUserIds = selections
        .map(selectionUserId)
        .filter((id): id is string => Boolean(id))

      if (contactUserIds.length === 0) {
        toast({ title: t('shareNoContacts'), variant: 'destructive' })
        return
      }

      startTransition(async () => {
        const result = await shareToContacts({
          targetType,
          targetId,
          title,
          description,
          url,
          previewImage,
          contactUserIds,
          locale,
        })
        if (!result.success) {
          toast({ title: result.error ?? t('shareFailed'), variant: 'destructive' })
          return
        }
        toast({ title: result.message ?? t('shareSuccess') })
        setOpen(false)
      })
    },
    [
      targetType,
      targetId,
      title,
      description,
      url,
      previewImage,
      locale,
      t,
    ],
  )

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={cn('h-8 gap-1 text-xs', className)}
        onClick={() => setOpen(true)}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <Share2 className="h-3.5 w-3.5" aria-hidden />
        )}
        {shareLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('sharePickContacts')}</DialogTitle>
          </DialogHeader>
          <ContactPicker
            locale={locale}
            mode="message"
            selectionMode="multiple"
            onSelect={() => {}}
            onConfirmMultiple={onConfirmMultiple}
            confirmLabel={t('shareConfirm')}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

export default ShareToChatButton
