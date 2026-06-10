'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Search } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useUserSearch } from '@/hooks/use-user-search'
import type { UseConversationsResult } from '@/hooks/use-messaging'
import type { UserSearchResult } from '@/features/auth/services/search-users'

interface NewConversationDialogProps {
  open: boolean
  onOpenChangeAction: (open: boolean) => void
  createConversation: UseConversationsResult['createConversation']
  onConversationCreatedAction: (conversationId: string) => void
}

export function NewConversationDialog({
  open,
  onOpenChangeAction,
  createConversation,
  onConversationCreatedAction,
}: NewConversationDialogProps) {
  const t = useTranslations('modules.messenger')
  const { results, loading, error, search, clear, term } = useUserSearch()
  const [creatingFor, setCreatingFor] = useState<string | null>(null)

  const handleSelect = async (user: UserSearchResult) => {
    setCreatingFor(user.id)
    try {
      const displayName = user.name || user.username || user.id
      const conversation = await createConversation({
        type: 'direct',
        participantIds: [user.id],
        metadata: {
          directUserId: user.id,
          directUserName: displayName,
        },
      })
      if (conversation) {
        clear()
        onOpenChangeAction(false)
        onConversationCreatedAction(conversation.id)
      }
    } finally {
      setCreatingFor(null)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) clear()
        onOpenChangeAction(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('newConversationTitle')}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder={t('searchUsersPlaceholder')}
            value={term}
            onChange={(e) => search(e.target.value)}
            className="pl-10"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="max-h-72 overflow-y-auto space-y-1">
          {loading && (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {t('searchingUsers')}
            </div>
          )}
          {!loading && term.trim().length >= 2 && results.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">{t('noUsersFound')}</p>
          )}
          {results.map((user) => {
            const label = user.name || user.username || user.id
            const isCreating = creatingFor === user.id
            return (
              <Button
                key={user.id}
                type="button"
                variant="ghost"
                className="w-full justify-start h-auto py-3"
                disabled={isCreating}
                onClick={() => void handleSelect(user)}
              >
                <div className="flex flex-col items-start text-left">
                  <span className="font-medium">{label}</span>
                  {user.username && (
                    <span className="text-xs text-muted-foreground">@{user.username}</span>
                  )}
                </div>
                {isCreating && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
              </Button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
