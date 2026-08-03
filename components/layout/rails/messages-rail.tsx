'use client'

import React from 'react'
import Link from 'next/link'
import { ListTodo, MessageCircle, Plus, Search } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { ConversationList, type ConversationInboxProps } from '@/features/chat/components/conversation-list'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
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
 * Messages right-rail: title + Tasks + Plus, search, full-height scrollable conversation roster.
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
  const tNav = useTranslations('navigation')
  const locale = useLocale() as Locale
  const tasksHref = selectedConversationId
    ? ROUTES.TASK(selectedConversationId, locale)
    : ROUTES.TASKS(locale)

  return (
    <div
      className={cn(
        'flex h-[calc(100dvh-5.5rem)] min-h-0 flex-col',
        className,
      )}
    >
      <div className="shrink-0 space-y-3 pb-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex min-w-0 items-center gap-2 text-2xl font-bold text-foreground">
            <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
            <span className="truncate">{t('title')}</span>
          </h1>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-11 w-11 p-0"
              asChild
            >
              <Link href={tasksHref} aria-label={tNav('tasks')}>
                <ListTodo className="h-6 w-6" />
              </Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-11 w-11 p-0"
              onClick={onNewConversation}
              aria-label={t('newConversationTitle')}
            >
              <Plus className="h-6 w-6" />
            </Button>
          </div>
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
