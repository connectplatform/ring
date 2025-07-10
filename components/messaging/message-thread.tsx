'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { MessageBubble } from './message-bubble'
import { TypingIndicator } from './typing-indicator'
import { MessageComposer } from './message-composer'
import { useMessages, useConversation } from '@/hooks/use-messaging'
import { Message } from '@/features/chat/types'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MessageThreadProps {
  conversationId: string
  userId: string
  className?: string
  onMessageEditAction?: (messageId: string, newContent: string) => Promise<void>
  onMessageDeleteAction?: (messageId: string) => Promise<void>
  onMessageReactionAction?: (messageId: string, emoji: string) => Promise<void>
}

export function MessageThread({
  conversationId,
  userId,
  className,
  onMessageEditAction,
  onMessageDeleteAction,
  onMessageReactionAction
}: MessageThreadProps) {
  const [replyTo, setReplyTo] = useState<Message | undefined>()
  const [isNearBottom, setIsNearBottom] = useState(true)
  const [showScrollButton, setShowScrollButton] = useState(false)
  
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const { conversation } = useConversation(conversationId)
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

  // Mark messages as read when they come into view
  useEffect(() => {
    if (isNearBottom && messages.length > 0) {
      // TODO: Implement markAsRead functionality
      // This would call an API to mark messages as read
    }
  }, [isNearBottom, messages.length])

  // Group messages by sender and time for better display
  const groupMessages = (messages: Message[]) => {
    const grouped: Array<{ messages: Message[]; showAvatar: boolean }> = []
    
    messages.forEach((message, index) => {
      const prevMessage = messages[index - 1]
      const isSameSender = prevMessage?.senderId === message.senderId
      const isWithinTimeFrame = prevMessage && 
        (message.timestamp.toMillis() - prevMessage.timestamp.toMillis()) < 5 * 60 * 1000 // 5 minutes
      
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

  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Messages area */}
      <div className="flex-1 relative">
        <ScrollArea 
          ref={scrollAreaRef}
          className="h-full"
          onScrollCapture={handleScroll}
        >
          <div className="p-4 space-y-1">
            {/* Loading indicator for older messages */}
            {loading && hasMore && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
              className="rounded-full h-10 w-10 p-0 shadow-lg"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Message composer */}
      <MessageComposer
        conversationId={conversationId}
        onSendMessageAction={handleSendMessage}
        replyTo={replyTo}
        onCancelReplyAction={handleCancelReply}
      />
    </div>
  )
} 