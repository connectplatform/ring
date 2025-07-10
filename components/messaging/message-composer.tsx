'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Paperclip, Image, Smile } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useTyping } from '@/hooks/use-messaging'
import { Message, SendMessageRequest } from '@/features/chat/types'
import { cn } from '@/lib/utils'

interface MessageComposerProps {
  conversationId: string
  onMessageSentAction?: (message: Message) => void
  onSendMessageAction?: (content: string, options?: Partial<SendMessageRequest>) => Promise<Message | null>
  placeholder?: string
  disabled?: boolean
  className?: string
  replyTo?: Message
  onCancelReplyAction?: () => void
}

export function MessageComposer({
  conversationId,
  onMessageSentAction,
  onSendMessageAction,
  placeholder = "Type a message...",
  disabled = false,
  className,
  replyTo,
  onCancelReplyAction
}: MessageComposerProps) {
  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { startTyping, stopTyping } = useTyping(conversationId)

  // Draft persistence in localStorage
  const draftKey = `draft_${conversationId}`

  // Load draft on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem(draftKey)
    if (savedDraft) {
      setContent(savedDraft)
    }
  }, [draftKey])

  // Save draft on content change
  useEffect(() => {
    if (content.trim()) {
      localStorage.setItem(draftKey, content)
    } else {
      localStorage.removeItem(draftKey)
    }
  }, [content, draftKey])

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    }
  }, [content])

  // Handle typing indicators
  const handleInputChange = useCallback((value: string) => {
    setContent(value)
    
    if (value.trim()) {
      startTyping()
    } else {
      stopTyping()
    }
  }, [startTyping, stopTyping])

  // Debounced typing stop
  useEffect(() => {
    const timer = setTimeout(() => {
      if (content.trim()) {
        stopTyping()
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [content, stopTyping])

  const handleSend = async () => {
    if (!content.trim() || isLoading || !onSendMessageAction) return

    setIsLoading(true)
    stopTyping()

    try {
      const messageOptions: Partial<SendMessageRequest> = {}
      
      if (replyTo) {
        messageOptions.replyTo = replyTo.id
      }

      const sentMessage = await onSendMessageAction(content.trim(), messageOptions)
      
      if (sentMessage) {
        setContent('')
        localStorage.removeItem(draftKey)
        onMessageSentAction?.(sentMessage)
        onCancelReplyAction?.()
        
        // Focus back to textarea
        textareaRef.current?.focus()
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileUpload = () => {
    // TODO: Implement file upload
    // This would open a file picker and handle file upload to Vercel Blob
    console.log('File upload not yet implemented')
  }

  const handleImageUpload = () => {
    // TODO: Implement image upload
    // This would open an image picker and handle image upload
    console.log('Image upload not yet implemented')
  }

  const handleEmojiPicker = () => {
    // TODO: Implement emoji picker
    // This would open an emoji picker component
    console.log('Emoji picker not yet implemented')
  }

  return (
    <div className={cn("border-t bg-background p-4", className)}>
      {/* Reply indicator */}
      {replyTo && (
        <div className="mb-2 p-2 bg-muted rounded-lg text-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-muted-foreground">Replying to </span>
              <span className="font-medium">{replyTo.senderName}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancelReplyAction}
              className="h-6 w-6 p-0"
            >
              ×
            </Button>
          </div>
          <div className="text-muted-foreground mt-1 truncate">
            {replyTo.content}
          </div>
        </div>
      )}

      <div className="flex items-end space-x-2">
        {/* File upload buttons */}
        <div className="flex space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFileUpload}
            disabled={disabled || isLoading}
            className="h-8 w-8 p-0"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleImageUpload}
            disabled={disabled || isLoading}
            className="h-8 w-8 p-0"
          >
                          <Image className="h-4 w-4" />
          </Button>
        </div>

        {/* Text input */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            className="min-h-[40px] max-h-[120px] resize-none pr-12"
            rows={1}
          />
          
          {/* Emoji button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEmojiPicker}
            disabled={disabled || isLoading}
            className="absolute right-2 bottom-2 h-6 w-6 p-0"
          >
            <Smile className="h-4 w-4" />
          </Button>
        </div>

        {/* Send button */}
        <Button
          onClick={handleSend}
          disabled={!content.trim() || disabled || isLoading}
          size="sm"
          className="h-8 w-8 p-0"
        >
          {isLoading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Helper text */}
      <div className="mt-2 text-xs text-muted-foreground">
        Press Enter to send, Shift+Enter for new line
      </div>
    </div>
  )
} 