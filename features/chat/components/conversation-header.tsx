'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import {
  MoreVertical,
  Archive,
  Bell,
  BellOff,
  Circle,
  MailOpen,
  Phone,
  Trash2,
  Users,
  Video,
  ExternalLink,
} from 'lucide-react'
import { Conversation } from '@/features/chat/types'
import {
  getConversationSubtitle,
  getConversationTitle,
  getConversationTypeGlyph,
} from '@/features/chat/lib/conversation-display'
import { getConversationAvatarUrl, getParticipantInitial } from '@/features/chat/lib/conversation-avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

interface ConversationHeaderProps {
  conversation: Conversation
  currentUserId: string
  onArchiveAction?: () => void | Promise<void>
  onMarkUnreadAction?: () => void | Promise<void>
  onToggleNotificationsAction?: () => void | Promise<void>
  onDeleteAction?: () => void | Promise<void>
  onGroupInfoAction?: () => void | Promise<void>
  /** 1:1 audio call (direct only). */
  onAudioCallAction?: () => void | Promise<void>
  /** 1:1 video call (direct only). */
  onVideoCallAction?: () => void | Promise<void>
  /** Product-agent continuity: open store product page (SSOT conversation stays here). */
  onOpenProductAction?: () => void | Promise<void>
  className?: string
}

export function ConversationHeader({
  conversation,
  currentUserId,
  onArchiveAction,
  onMarkUnreadAction,
  onToggleNotificationsAction,
  onDeleteAction,
  onGroupInfoAction,
  onAudioCallAction,
  onVideoCallAction,
  onOpenProductAction,
  className,
}: ConversationHeaderProps) {
  const t = useTranslations('modules.messenger')
  const [busy, setBusy] = useState(false)
  const title = getConversationTitle(conversation, currentUserId)
  const subtitle = getConversationSubtitle(conversation, currentUserId)
  const avatarUrl = getConversationAvatarUrl(conversation, currentUserId)
  const other = conversation.participants.find((p) => p.userId !== currentUserId)
  const isMuted = conversation.metadata?.mutedBy?.includes(currentUserId) ?? false

  const getOnlineStatus = () => {
    if (conversation.type === 'direct') {
      return other?.isOnline
    }
    return conversation.participants.some((p) => p.isOnline && p.userId !== currentUserId)
  }

  const run = async (fn?: () => void | Promise<void>) => {
    if (!fn || busy) return
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between bg-transparent px-[5px] py-[5px]',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-primary text-sm font-medium text-primary-foreground">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={title}
              width={40}
              height={40}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center" aria-hidden>
              {getParticipantInitial(other, title) || getConversationTypeGlyph(conversation.type)}
            </span>
          )}
          {getOnlineStatus() && (
            <Circle className="absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-green-500 text-green-500" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{title}</h3>
            <Badge variant="secondary" className="text-xs">
              {conversation.type}
            </Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {onOpenProductAction && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 w-11 p-0"
            aria-label={t('openOnProductPage')}
            disabled={busy}
            onClick={() => void run(onOpenProductAction)}
          >
            <ExternalLink className="h-5 w-5" />
          </Button>
        )}
        {onAudioCallAction && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 w-11 p-0"
            aria-label={t('callAudio')}
            disabled={busy}
            onClick={() => void run(onAudioCallAction)}
          >
            <Phone className="h-5 w-5" />
          </Button>
        )}
        {onVideoCallAction && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 w-11 p-0"
            aria-label={t('callVideo')}
            disabled={busy}
            onClick={() => void run(onVideoCallAction)}
          >
            <Video className="h-5 w-5" />
          </Button>
        )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-11 w-11 shrink-0 p-0"
            aria-label={t('conversationMenu')}
            disabled={busy}
          >
            <MoreVertical className="h-6 w-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {conversation.type === 'group' && onGroupInfoAction && (
            <>
              <DropdownMenuItem onClick={() => void run(onGroupInfoAction)}>
                <Users className="mr-2 h-4 w-4" />
                {t('groupInfo')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={() => void run(onArchiveAction)}>
            <Archive className="mr-2 h-4 w-4" />
            {t('menuArchive')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void run(onMarkUnreadAction)}>
            <MailOpen className="mr-2 h-4 w-4" />
            {t('menuMarkUnread')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void run(onToggleNotificationsAction)}>
            {isMuted ? (
              <Bell className="mr-2 h-4 w-4" />
            ) : (
              <BellOff className="mr-2 h-4 w-4" />
            )}
            {isMuted ? t('menuEnableNotifications') : t('menuMuteNotifications')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => void run(onDeleteAction)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t('menuDelete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </div>
  )
}
