'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ContactPicker, type ContactPickerSelection } from '@/components/contacts'
import type { UseConversationsResult } from '@/hooks/use-messaging'
import type { Locale } from '@/i18n/shared'

interface NewConversationDialogProps {
  open: boolean
  onOpenChangeAction: (open: boolean) => void
  createConversation: UseConversationsResult['createConversation']
  onConversationCreatedAction: (conversationId: string) => void
  locale?: Locale
  excludeUserIds?: string[]
}

export function NewConversationDialog({
  open,
  onOpenChangeAction,
  createConversation,
  onConversationCreatedAction,
  locale: localeProp,
  excludeUserIds = [],
}: NewConversationDialogProps) {
  const t = useTranslations('modules.messenger')
  const localeFromHook = useLocale() as Locale
  const activeLocale = localeProp ?? localeFromHook
  const [creatingFor, setCreatingFor] = useState<string | null>(null)

  const startConversation = async (targetUserId: string, displayName: string) => {
    setCreatingFor(targetUserId)
    try {
      const conversation = await createConversation({
        type: 'direct',
        participantIds: [targetUserId],
        metadata: {
          directUserId: targetUserId,
          directUserName: displayName,
        },
      })
      if (conversation) {
        onOpenChangeAction(false)
        onConversationCreatedAction(conversation.id)
      }
    } finally {
      setCreatingFor(null)
    }
  }

  const handleSelect = (selection: ContactPickerSelection) => {
    if (selection.kind === 'user') {
      const user = selection.user
      const displayName = user.name || user.username || user.id
      void startConversation(user.id, displayName)
      return
    }

    const contact = selection.contact
    void startConversation(contact.contactUserId, contact.displayName)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('newConversationTitle')}</DialogTitle>
        </DialogHeader>
        {creatingFor ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            {t('searchingUsers')}
          </div>
        ) : (
          <ContactPicker
            locale={activeLocale}
            mode="message"
            onSelect={handleSelect}
            excludeUserIds={excludeUserIds}
            showSaved
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
