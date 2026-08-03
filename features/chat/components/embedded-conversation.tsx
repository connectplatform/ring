'use client'

/**
 * Embedded conversation — cornerstone chat embed for CRM / Order Lab / support.
 * Shared history + composer; variant only changes chrome (header strip).
 */

import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { ConversationHeader } from '@/features/chat/components/conversation-header'
import { MessageThread } from '@/features/chat/components/message-thread'
import { useConversation } from '@/hooks/use-messaging'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

export type EmbeddedConversationVariant = 'default' | 'support' | 'order_lab'

export function EmbeddedConversation({
  conversationId,
  userId,
  variant = 'default',
  className,
  headerExtra,
  preferChat,
}: {
  conversationId: string
  userId: string
  variant?: EmbeddedConversationVariant
  className?: string
  headerExtra?: ReactNode
  /** Support channel badge when client prefers in-app chat */
  preferChat?: boolean
}) {
  const { conversation, loading } = useConversation(conversationId, {
    enabled: !!conversationId,
  })

  if (loading || !conversation) {
    return (
      <div
        className={cn(
          'flex flex-1 items-center justify-center text-muted-foreground',
          className,
        )}
      >
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      </div>
    )
  }

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      {(variant === 'support' || headerExtra || preferChat) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/50 px-3 py-1.5 text-xs text-muted-foreground">
          {variant === 'support' && (
            <Badge variant="secondary" className="text-[10px]">
              Support
            </Badge>
          )}
          {variant === 'order_lab' && (
            <Badge variant="outline" className="text-[10px]">
              Order Lab
            </Badge>
          )}
          {preferChat ? (
            <Badge variant="default" className="text-[10px]">
              In-app chat preferred
            </Badge>
          ) : variant === 'support' ? (
            <span>Email + chat available</span>
          ) : null}
          {headerExtra}
        </div>
      )}
      <ConversationHeader conversation={conversation} currentUserId={userId} />
      <MessageThread
        className="min-h-0 flex-1"
        conversation={conversation}
        conversationId={conversationId}
        userId={userId}
      />
    </div>
  )
}

/** Thin alias for Order Lab / CRM embeds — default chrome (no Order Lab badge on DMs). */
export function LabThread({
  conversationId,
  userId,
}: {
  conversationId: string
  userId: string
}) {
  return (
    <EmbeddedConversation
      conversationId={conversationId}
      userId={userId}
      variant="default"
    />
  )
}
