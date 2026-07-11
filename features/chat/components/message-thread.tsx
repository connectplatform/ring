'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { MessageBubble } from './message-bubble'
import { TypingIndicator } from './typing-indicator'
import { MessageComposer } from './message-composer'
import { useMessages, useConversation, useMarkConversationRead } from '@/hooks/use-messaging'
import { Conversation, Message } from '@/features/chat/types'
import { getMessageTimeMs } from '@/features/chat/lib/message-time'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

interface MessageThreadProps {
  conversationId: string
  userId: string
  /** When provided, skips duplicate useConversation fetch (e.g. Ring Messenger shell) */
  conversation?: Conversation | null
  className?: string
  onMessageEditAction?: (messageId: string, newContent: string) => Promise<void>
  onMessageDeleteAction?: (messageId: string) => Promise<void>
  onMessageReactionAction?: (messageId: string, emoji: string) => Promise<void>
}

export function MessageThread({
  conversationId,
  userId,
  conversation: conversationProp,
  className,
  onMessageEditAction,
  onMessageDeleteAction,
  onMessageReactionAction
}: MessageThreadProps) {
  const t = useTranslations('modules.messenger')
  const [replyTo, setReplyTo] = useState<Message | undefined>()
  const [isNearBottom, setIsNearBottom] = useState(true)
  const [showScrollButton, setShowScrollButton] = useState(false)
  
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const { conversation: fetched, loading: convLoading } = useConversation(conversationId, {
    enabled: !conversationProp
  })
  const conversation = conversationProp ?? fetched
  const { markAsRead } = useMarkConversationRead(conversationId)
  const { 
    messages, 
    loading, 
    hasMore, 
    loadMore, 
    sendMessage
  } = useMessages(conversationId)

  // Auto-scroll to bottom for new messages
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ 
      behavior: smooth ? 'smooth' : 'auto' 
    })
  }, [])

  // Handle scroll events
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget
    const scrollTop = container.scrollTop
    const scrollHeight = container.scrollHeight
    const clientHeight = container.clientHeight
    
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    const nearBottom = distanceFromBottom < 100
    
    setIsNearBottom(nearBottom)
    setShowScrollButton(!nearBottom && messages.length > 0)
    
    // Load more messages when scrolling to top
    if (scrollTop < 100 && hasMore && !loading) {
      loadMore()
    }
  }, [hasMore, loading, loadMore, messages.length])

  // Auto-scroll to bottom on new messages (only if user is near bottom)
  useEffect(() => {
    if (isNearBottom && messages.length > 0) {
      scrollToBottom()
    }
  }, [messages.length, isNearBottom, scrollToBottom])

  // Clear roster unread when this thread is focused (pairs with conversations:inbox bumps).
  useEffect(() => {
    if (!conversationId) return
    // Parent inbox refresh is triggered by shell select; local markAsRead handles server.
    void markAsRead()
  }, [conversationId, markAsRead])

  useEffect(() => {
    if (isNearBottom && messages.length > 0) {
      void markAsRead()
    }
  }, [isNearBottom, messages.length, markAsRead])

  // Group messages by sender and time for better display
  const groupMessages = (messages: Message[]) => {
    const grouped: Array<{ messages: Message[]; showAvatar: boolean }> = []
    
    messages.forEach((message, index) => {
      const prevMessage = messages[index - 1]
      const isSameSender = prevMessage?.senderId === message.senderId
      const isWithinTimeFrame =
        prevMessage &&
        getMessageTimeMs(message.timestamp) - getMessageTimeMs(prevMessage.timestamp) <
          5 * 60 * 1000
      
      if (isSameSender && isWithinTimeFrame) {
        // Add to existing group
        const lastGroup = grouped[grouped.length - 1]
        lastGroup.messages.push(message)
      } else {
        // Create new group
        grouped.push({
          messages: [message],
          showAvatar: true
        })
      }
    })
    
    return grouped
  }

  const messageGroups = groupMessages(messages)

  const handleSendMessage = useCallback(async (content: string, options?: any) => {
    try {
      const message = await sendMessage(content, options)
      if (message) {
        setReplyTo(undefined)
        return message
      }
      return null
    } catch (error) {
      console.error('Failed to send message:', error)
      return null
    }
  }, [sendMessage])

  const handleReply = useCallback((message: Message) => {
    setReplyTo(message)
  }, [])

  const handleCancelReply = useCallback(() => {
    setReplyTo(undefined)
  }, [])

  if (!conversation && convLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Conversation not found
      </div>
    )
  }

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      {/* Messages area — flex-1 so composer stays sticky at bottom of the pane */}
      <div className="relative min-h-0 flex-1">
        <ScrollArea
          ref={scrollAreaRef}
          className="h-full"
          onScrollCapture={handleScroll}
        >
          <div className="space-y-1 p-4">
            {/* Loading indicator for older messages */}
            {loading && hasMore && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Empty-thread CTA — UPGRADE: per-type copy (product agent vs human DM) */}
            {!loading && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <p className="text-sm font-medium text-foreground">
                  {conversation.type === 'product'
                    ? t('emptyThreadProduct')
                    : t('emptyThreadHello')}
                </p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  {t('emptyThreadHint')}
                </p>
              </div>
            )}

            {/* Messages */}
            {messageGroups.map((group, groupIndex) => (
              <div key={`group-${groupIndex}`}>
                {group.messages.map((message, messageIndex) => (
                                     <MessageBubble
                     key={message.id}
                     message={message}
                     isOwn={message.senderId === userId}
                     showAvatar={messageIndex === 0 && group.showAvatar}
                     onEditAction={onMessageEditAction ? (messageId) => onMessageEditAction(messageId, '') : undefined}
                     onDeleteAction={onMessageDeleteAction ? (messageId) => onMessageDeleteAction(messageId) : undefined}
                     onReplyAction={handleReply}
                     onReactionAction={onMessageReactionAction ? (messageId, emoji) => onMessageReactionAction(messageId, emoji) : undefined}
                   />
                ))}
              </div>
            ))}

            {/* Typing indicator */}
            <TypingIndicator conversationId={conversationId} />

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Scroll to bottom button */}
        {showScrollButton && (
          <div className="absolute bottom-4 right-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => scrollToBottom()}
              className="h-10 w-10 rounded-full p-0 shadow-lg"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Sticky composer — shrink-0 keeps it pinned under the scroll region */}
      <div className="shrink-0 border-t border-border/40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <MessageComposer
          key={conversationId}
          conversationId={conversationId}
          onSendMessageAction={handleSendMessage}
          replyTo={replyTo}
          onCancelReplyAction={handleCancelReply}
          placeholder={
            messages.length === 0
              ? conversation.type === 'product'
                ? t('emptyThreadProduct')
                : t('emptyThreadHello')
              : undefined
          }
        />
      </div>
    </div>
  )
} 