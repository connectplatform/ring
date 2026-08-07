'use client'

import React, { useDeferredValue, useMemo, useState } from 'react'
import Image from 'next/image'
import { Search, Plus, Circle, BellOff } from 'lucide-react'
import type { UseConversationsResult } from '@/hooks/use-messaging'
import { Conversation } from '@/features/chat/types'
import {
  formatConversationTime,
  getConversationSearchText,
  getConversationTitle,
  getConversationTypeGlyph,
  getLastMessagePreview,
} from '@/features/chat/lib/conversation-display'
import {
  getConversationAvatarUrl,
  getParticipantInitial,
} from '@/features/chat/lib/conversation-avatar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

export type ConversationInboxProps = Pick<
  UseConversationsResult,
  'conversations' | 'loading' | 'error' | 'hasMore' | 'loadMore' | 'refresh'
>

interface ConversationListProps {
  userId: string
  inbox: ConversationInboxProps
  onConversationSelectAction: (conversationId: string) => void
  selectedConversationId?: string
  onNewConversationAction?: () => void
  className?: string
  /** `rail` omits title/search/+ chrome (owned by messages-rail). */
  variant?: 'standalone' | 'rail'
  /** Controlled search when parent owns the search input (rail). */
  searchQuery?: string
  onSearchQueryChange?: (value: string) => void
  showSearch?: boolean
}

interface ConversationItemProps {
  conversation: Conversation
  isSelected: boolean
  onClick: () => void
  currentUserId: string
}

function ConversationItem({
  conversation,
  isSelected,
  onClick,
  currentUserId,
}: ConversationItemProps) {
  const title = getConversationTitle(conversation, currentUserId)
  const preview = getLastMessagePreview(conversation, currentUserId)
  const unreadCount = conversation.unreadCount ?? 0
  const avatarUrl = getConversationAvatarUrl(conversation, currentUserId)
  const other = conversation.participants.find((p) => p.userId !== currentUserId)
  const isMuted = conversation.metadata?.mutedBy?.includes(currentUserId) ?? false
  const isOnline = conversation.participants
    .filter((p) => p.userId !== currentUserId)
    .some((p) => p.isOnline)

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center space-x-3 rounded-lg p-3 text-left transition-colors',
        'hover:bg-accent/50',
        isSelected && 'bg-accent',
      )}
    >
      <div className="relative flex-shrink-0">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-medium text-primary-foreground">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={title}
              width={40}
              height={40}
              className="h-full w-full object-cover"
            />
          ) : (
            <span aria-hidden>
              {getParticipantInitial(other, title) || getConversationTypeGlyph(conversation.type)}
            </span>
          )}
        </div>
        {isOnline && (
          <Circle className="absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-green-500 text-green-500" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h4 className="flex min-w-0 items-center gap-1 truncate text-sm font-medium">
            <span className="truncate">{title}</span>
            {isMuted && (
              <BellOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Muted" />
            )}
          </h4>
          <div className="flex shrink-0 items-center space-x-1">
            {conversation.lastMessage && (
              <span className="text-xs text-muted-foreground">
                {formatConversationTime(conversation.lastMessage.timestamp)}
              </span>
            )}
            {unreadCount > 0 && (
              <Badge variant="destructive" className="h-5 min-w-5 px-1 text-xs">
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="truncate text-xs text-muted-foreground">{preview}</p>
          <Badge variant="outline" className="ml-2 shrink-0 text-xs">
            {conversation.type}
          </Badge>
        </div>
      </div>
    </button>
  )
}

export function ConversationList({
  userId,
  inbox,
  onConversationSelectAction,
  selectedConversationId,
  onNewConversationAction,
  className,
  variant = 'standalone',
  searchQuery: controlledSearch,
  onSearchQueryChange,
  showSearch = true,
}: ConversationListProps) {
  const [internalSearch, setInternalSearch] = useState('')
  const searchQuery = controlledSearch ?? internalSearch
  const deferredQuery = useDeferredValue(searchQuery)
  const { conversations, loading, error, hasMore, loadMore } = inbox
  const isRail = variant === 'rail'

  const setSearch = (value: string) => {
    if (onSearchQueryChange) {
      onSearchQueryChange(value)
    } else {
      setInternalSearch(value)
    }
  }

  const filteredConversations = useMemo(() => {
    const list = conversations ?? []
    const q = deferredQuery.trim().toLowerCase()
    if (!q) return list
    return list.filter((conversation) =>
      getConversationSearchText(conversation, userId).includes(q),
    )
  }, [conversations, deferredQuery, userId])

  if (loading && (conversations?.length ?? 0) === 0) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center text-destructive">
        <p>Failed to load conversations</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      {!isRail && (
        <div className="shrink-0 border-b p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Messages</h2>
            {onNewConversationAction && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onNewConversationAction}
                className="h-11 w-11 p-0"
                aria-label="New conversation"
              >
                <Plus className="h-6 w-6" />
              </Button>
            )}
          </div>

          {showSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          )}
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        <div className={cn(isRail ? 'px-0 py-1' : 'p-2')}>
          {filteredConversations.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              {deferredQuery.trim() ? 'No conversations found' : 'No conversations yet'}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredConversations.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  isSelected={selectedConversationId === conversation.id}
                  onClick={() => onConversationSelectAction(conversation.id)}
                  currentUserId={userId}
                />
              ))}
              {hasMore && (
                <div className="pb-1 pt-2 text-center">
                  <Button type="button" variant="ghost" size="sm" onClick={loadMore}>
                    Load more
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
