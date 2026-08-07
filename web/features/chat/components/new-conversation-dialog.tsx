'use client'

import { useMemo, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ContactPicker, type ContactPickerSelection } from '@/components/contacts'
import type { UseConversationsResult } from '@/hooks/use-messaging'
import { openOrCreateDirectConversation } from '@/features/chat/lib/open-or-create-direct'
import { getMessageTimeMs } from '@/features/chat/lib/message-time'
import { toast } from '@/hooks/use-toast'
import type { Locale } from '@/i18n/shared'

interface NewConversationDialogProps {
  open: boolean
  onOpenChangeAction: (open: boolean) => void
  createConversation: UseConversationsResult['createConversation']
  conversations: UseConversationsResult['conversations']
  currentUserId: string
  onConversationCreatedAction: (conversationId: string) => void
  locale?: Locale
  excludeUserIds?: string[]
}

function selectionTarget(selection: ContactPickerSelection): {
  userId: string
  displayName: string
} {
  if (selection.kind === 'user') {
    return {
      userId: selection.user.id,
      displayName: selection.user.name || selection.user.username || selection.user.id,
    }
  }
  return {
    userId: selection.contact.contactUserId,
    displayName: selection.contact.displayName,
  }
}

export function NewConversationDialog({
  open,
  onOpenChangeAction,
  createConversation,
  conversations,
  currentUserId,
  onConversationCreatedAction,
  locale: localeProp,
  excludeUserIds = [],
}: NewConversationDialogProps) {
  const t = useTranslations('modules.messenger')
  const localeFromHook = useLocale() as Locale
  const activeLocale = localeProp ?? localeFromHook
  const [tab, setTab] = useState<'direct' | 'group'>('direct')
  const [creating, setCreating] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupSelectedIds, setGroupSelectedIds] = useState<string[]>([])

  const recencyByUserId = useMemo(() => {
    const map: Record<string, number> = {}
    for (const conversation of conversations) {
      if (conversation.type !== 'direct') continue
      const other =
        conversation.participants.find((p) => p.userId === conversation.metadata.directUserId) ||
        conversation.participants.find((p) => p.userId !== currentUserId)
      if (!other) continue
      const activity = conversation.lastActivity ?? conversation.updatedAt
      const ts = getMessageTimeMs(activity as Parameters<typeof getMessageTimeMs>[0])
      map[other.userId] = Math.max(map[other.userId] ?? 0, ts)
    }
    return map
  }, [conversations, currentUserId])

  const resetGroupState = () => {
    setGroupName('')
    setGroupSelectedIds([])
  }

  const startDirect = async (targetUserId: string, displayName: string) => {
    setCreating(true)
    try {
      const conversation = await openOrCreateDirectConversation({
        currentUserId,
        targetUserId,
        displayName,
        conversations,
        createConversation,
      })
      if (conversation) {
        onOpenChangeAction(false)
        onConversationCreatedAction(conversation.id)
      }
    } finally {
      setCreating(false)
    }
  }

  const handleDirectSelect = (selection: ContactPickerSelection) => {
    const { userId, displayName } = selectionTarget(selection)
    void startDirect(userId, displayName)
  }

  const handleCreateGroup = async (selections: ContactPickerSelection[]) => {
    const name = groupName.trim()
    if (!name) {
      toast({
        title: t('groupNameRequired'),
        variant: 'destructive',
      })
      return
    }
    if (selections.length === 0) return

    setCreating(true)
    try {
      const participantIds = selections.map((s) => selectionTarget(s).userId)
      const conversation = await createConversation({
        type: 'group',
        participantIds,
        metadata: { groupName: name },
      })
      if (conversation) {
        resetGroupState()
        onOpenChangeAction(false)
        onConversationCreatedAction(conversation.id)
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetGroupState()
        onOpenChangeAction(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('newConversationTitle')}</DialogTitle>
        </DialogHeader>

        {creating ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('searchingUsers')}
          </div>
        ) : (
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as 'direct' | 'group')}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="direct">{t('tabDirect')}</TabsTrigger>
              <TabsTrigger value="group">{t('tabGroup')}</TabsTrigger>
            </TabsList>

            <TabsContent value="direct" className="mt-3">
              <ContactPicker
                locale={activeLocale}
                mode="message"
                selectionMode="single"
                onSelect={handleDirectSelect}
                excludeUserIds={excludeUserIds}
                showSaved
                recencyByUserId={recencyByUserId}
              />
            </TabsContent>

            <TabsContent value="group" className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="group-title">{t('conversationTitle')}</Label>
                <Input
                  id="group-title"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder={t('groupNamePlaceholder')}
                  maxLength={80}
                />
              </div>
              <ContactPicker
                locale={activeLocale}
                mode="message"
                selectionMode="multiple"
                onSelect={() => undefined}
                excludeUserIds={excludeUserIds}
                showSaved
                recencyByUserId={recencyByUserId}
                selectedUserIds={groupSelectedIds}
                onSelectedUserIdsChange={setGroupSelectedIds}
                onConfirmMultiple={(selections) => void handleCreateGroup(selections)}
                confirmLabel={t('createGroup')}
              />
              {groupSelectedIds.length > 0 && !groupName.trim() && (
                <p className="text-xs text-muted-foreground">{t('groupNameRequired')}</p>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
