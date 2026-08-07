'use client'

import { useMemo, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, UserMinus } from 'lucide-react'
import type { Conversation } from '@/features/chat/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ContactPicker, type ContactPickerSelection } from '@/components/contacts'
import { apiClient } from '@/lib/api-client'
import { toast } from '@/hooks/use-toast'
import type { Locale } from '@/i18n/shared'

interface GroupMembersDialogProps {
  open: boolean
  onOpenChangeAction: (open: boolean) => void
  conversation: Conversation
  currentUserId: string
  onUpdatedAction?: () => void | Promise<void>
}

export function GroupMembersDialog({
  open,
  onOpenChangeAction,
  conversation,
  currentUserId,
  onUpdatedAction,
}: GroupMembersDialogProps) {
  const t = useTranslations('modules.messenger')
  const locale = useLocale() as Locale
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'list' | 'add'>('list')
  const [renameValue, setRenameValue] = useState(conversation.metadata.groupName || '')

  const isAdmin =
    conversation.participants.find((p) => p.userId === currentUserId)?.role === 'admin'

  const excludeUserIds = useMemo(
    () => conversation.participants.map((p) => p.userId),
    [conversation.participants],
  )

  const refresh = async () => {
    await onUpdatedAction?.()
  }

  const renameGroup = async () => {
    const groupName = renameValue.trim()
    if (!groupName || !isAdmin) return
    setBusy(true)
    try {
      const response = await apiClient.put(`/api/conversations/${conversation.id}`, {
        action: 'update_metadata',
        groupName,
      })
      if (!response.success) throw new Error(response.error || 'Rename failed')
      toast({ title: t('groupRenamed') })
      await refresh()
    } catch (err) {
      toast({
        title: t('actionFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  const removeMember = async (userId: string) => {
    setBusy(true)
    try {
      const response = await apiClient.put(`/api/conversations/${conversation.id}`, {
        action: 'remove_participant',
        userId,
      })
      if (!response.success) throw new Error(response.error || 'Remove failed')
      toast({ title: t('memberRemoved') })
      await refresh()
    } catch (err) {
      toast({
        title: t('actionFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  const addMembers = async (selections: ContactPickerSelection[]) => {
    setBusy(true)
    try {
      for (const selection of selections) {
        const userId =
          selection.kind === 'user' ? selection.user.id : selection.contact.contactUserId
        const response = await apiClient.put(`/api/conversations/${conversation.id}`, {
          action: 'add_participant',
          userId,
          role: 'member',
        })
        if (!response.success) {
          throw new Error(response.error || 'Add failed')
        }
      }
      toast({ title: t('membersAdded') })
      setMode('list')
      await refresh()
    } catch (err) {
      toast({
        title: t('actionFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setMode('list')
        onOpenChangeAction(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'add' ? t('addMembers') : t('groupInfo')}
          </DialogTitle>
        </DialogHeader>

        {busy ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          </div>
        ) : mode === 'add' ? (
          <div className="space-y-3">
            <ContactPicker
              locale={locale}
              mode="message"
              selectionMode="multiple"
              onSelect={() => undefined}
              excludeUserIds={excludeUserIds}
              showSaved
              onConfirmMultiple={(selections) => void addMembers(selections)}
              confirmLabel={t('addMembers')}
            />
            <Button type="button" variant="ghost" className="w-full" onClick={() => setMode('list')}>
              {t('backToMembers')}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {isAdmin && (
              <div className="space-y-1.5">
                <Label htmlFor="rename-group">{t('conversationTitle')}</Label>
                <div className="flex gap-2">
                  <Input
                    id="rename-group"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    maxLength={80}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!renameValue.trim() || renameValue.trim() === conversation.metadata.groupName}
                    onClick={() => void renameGroup()}
                  >
                    {t('renameGroup')}
                  </Button>
                </div>
              </div>
            )}

            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {conversation.participants.map((p) => (
                <li
                  key={p.userId}
                  className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-accent/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {p.displayName || p.userId}
                      {p.userId === currentUserId ? ` (${t('you')})` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">{p.role}</p>
                  </div>
                  {isAdmin && p.userId !== currentUserId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 text-destructive"
                      onClick={() => void removeMember(p.userId)}
                      aria-label={t('removeMember')}
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>

            {isAdmin && (
              <Button type="button" className="w-full" onClick={() => setMode('add')}>
                {t('addMembers')}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
