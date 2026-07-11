'use client'

import React from 'react'
import { MessageCircle, Plus, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ConversationList, type ConversationInboxProps } from '@/features/chat/components/conversation-list'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface MessagesSidebarContentProps {
  userId: string
  inbox: ConversationInboxProps
  selectedConversationId?: string | null
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  onConversationSelect: (conversationId: string) => void
  onNewConversation: () => void
  className?: string
}

/**
 * Messages right-rail: title + Plus, search, full-height scrollable conversation roster.
 * Product-agent (DAGI) chats appear as type=product rows in the same roster.
 */
export function MessagesSidebarContent({
  userId,
  inbox,
  selectedConversationId,
  searchQuery,
  onSearchQueryChange,
  onConversationSelect,
  onNewConversation,
  className,
}: MessagesSidebarContentProps) {
  const t = useTranslations('modules.messenger')

  return (
    <div
      className={cn(
        'flex h-[calc(100dvh-5.5rem)] min-h-0 flex-col',
        className,
      )}
    >
      <div className="shrink-0 space-y-3 pb-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <MessageCircle className="h-5 w-5" aria-hidden />
            {t('title')}
          </h1>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 w-11 shrink-0 p-0"
            onClick={onNewConversation}
            aria-label={t('newConversationTitle')}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('searchConversationsPlaceholder')}
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="pl-10"
            aria-label={t('searchConversationsPlaceholder')}
          />
        </div>
      </div>

      <ConversationList
        variant="rail"
        userId={userId}
        inbox={inbox}
        selectedConversationId={selectedConversationId || undefined}
        onConversationSelectAction={onConversationSelect}
        searchQuery={searchQuery}
        onSearchQueryChange={onSearchQueryChange}
        showSearch={false}
        className="min-h-0 flex-1"
      />
    </div>
  )
}
