'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Paperclip, Image, Smile, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { useTyping } from '@/hooks/use-messaging'
import { Message, SendMessageRequest } from '@/features/chat/types'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

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

interface FileAttachment {
  id: string
  file: File
  url: string
  type: 'image' | 'file' | 'video' | 'audio'
  uploading: boolean
  uploadProgress: number
  error?: string
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
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
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
    // Check if we have content or attachments ready to send
    const hasContent = content.trim().length > 0
    const hasAttachments = attachments.length > 0 && attachments.every(att => !att.uploading && att.url)
    
    if ((!hasContent && !hasAttachments) || isLoading || !onSendMessageAction) return

    // Check if any attachments are still uploading
    if (attachments.some(att => att.uploading)) {
      toast({
        title: 'Please wait',
        description: 'Files are still uploading...',
        variant: 'default'
      })
      return
    }

    // Check if any attachments have errors
    if (attachments.some(att => att.error)) {
      toast({
        title: 'Upload errors',
        description: 'Please remove failed uploads before sending',
        variant: 'destructive'
      })
      return
    }

    setIsLoading(true)
    stopTyping()

    try {
      const messageOptions: Partial<SendMessageRequest> = {}
      
      if (replyTo) {
        messageOptions.replyTo = replyTo.id
      }

      // Add attachments if any
      if (attachments.length > 0) {
        messageOptions.attachments = attachments.map(att => ({
          url: att.url,
          name: att.file.name,
          mimeType: att.file.type,
          size: att.file.size,
          type: att.type === 'image' ? 'image' : att.type === 'video' || att.type === 'audio' ? 'file' : 'document'
        }))
      }

      const sentMessage = await onSendMessageAction(content.trim(), messageOptions)
      
      if (sentMessage) {
        setContent('')
        setAttachments([])
        localStorage.removeItem(draftKey)
        onMessageSentAction?.(sentMessage)
        onCancelReplyAction?.()
        
        // Focus back to textarea
        textareaRef.current?.focus()
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      toast({
        title: 'Send failed',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive'
      })
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

  // File upload utilities
  const createFileAttachment = (file: File): FileAttachment => {
    const fileType = file.type.startsWith('image/') ? 'image' :
                    file.type.startsWith('video/') ? 'video' :
                    file.type.startsWith('audio/') ? 'audio' : 'file'
    
    return {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      file,
      url: '',
      type: fileType,
      uploading: true,
      uploadProgress: 0
    }
  }

  const uploadFile = async (attachment: FileAttachment) => {
    try {
      const formData = new FormData()
      formData.append('file', attachment.file)
      formData.append('conversationId', conversationId)

      const response = await fetch('/api/conversations/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const data = await response.json()
      
      setAttachments(prev => prev.map(att => 
        att.id === attachment.id 
          ? { ...att, uploading: false, uploadProgress: 100, url: data.url }
          : att
      ))

      return data.url
    } catch (error) {
      console.error('Error uploading file:', error)
      
      setAttachments(prev => prev.map(att => 
        att.id === attachment.id 
          ? { ...att, uploading: false, error: error instanceof Error ? error.message : 'Upload failed' }
          : att
      ))

      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload file',
        variant: 'destructive'
      })

      throw error
    }
  }

  const handleFileSelection = (files: FileList | null, fileType?: 'image') => {
    if (!files || files.length === 0) return

    Array.from(files).forEach(file => {
      // Validate file size (25MB limit)
      if (file.size > 25 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: `${file.name} exceeds the 25MB limit`,
          variant: 'destructive'
        })
        return
      }

      // Create attachment and start upload
      const attachment = createFileAttachment(file)
      setAttachments(prev => [...prev, attachment])
      
      // Start upload
      uploadFile(attachment)
    })
  }

  const handleFileUpload = () => {
    fileInputRef.current?.click()
  }

  const handleImageUpload = () => {
    imageInputRef.current?.click()
  }

  const removeAttachment = (attachmentId: string) => {
    setAttachments(prev => prev.filter(att => att.id !== attachmentId))
  }

  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const emojiPickerRef = useRef<HTMLDivElement>(null)

  const handleEmojiSelect = (emoji: string) => {
    setContent(prev => prev + emoji)
    setShowEmojiPicker(false)
    textareaRef.current?.focus()
  }

  const handleEmojiPicker = () => {
    setShowEmojiPicker(!showEmojiPicker)
  }

  // Close emoji picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false)
      }
    }

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showEmojiPicker])

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

      {/* File attachments preview */}
      {attachments.length > 0 && (
        <div className="mb-3 space-y-2">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <div className="flex-shrink-0">
                  {attachment.type === 'image' && (
                    <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                      <Image className="w-4 h-4 text-blue-600" />
                    </div>
                  )}
                  {attachment.type === 'file' && (
                    <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                      <Paperclip className="w-4 h-4 text-gray-600" />
                    </div>
                  )}
                  {(attachment.type === 'video' || attachment.type === 'audio') && (
                    <div className="w-8 h-8 bg-purple-100 rounded flex items-center justify-center">
                      <Paperclip className="w-4 h-4 text-purple-600" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{attachment.file.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {(attachment.file.size / 1024 / 1024).toFixed(1)} MB
                  </div>
                  {attachment.uploading && (
                    <Progress value={attachment.uploadProgress} className="mt-1 h-1" />
                  )}
                  {attachment.error && (
                    <div className="text-xs text-red-500 mt-1">{attachment.error}</div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-1">
                {attachment.uploading && (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAttachment(attachment.id)}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => handleFileSelection(e.target.files)}
        accept=".pdf,.doc,.docx,.txt,.zip,.rar"
      />
      <input
        ref={imageInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => handleFileSelection(e.target.files, 'image')}
        accept="image/*,video/*,audio/*"
      />

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
            aria-label="Upload image"
          >
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
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

          {/* Simple inline emoji picker */}
          {showEmojiPicker && (
            <div ref={emojiPickerRef} className="absolute right-0 bottom-10 bg-background border rounded-lg shadow-lg p-3 z-10 w-64">
              <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
                {[
                  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
                  '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
                  '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜',
                  '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏',
                  '👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟',
                  '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️',
                  '❤️', '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤',
                  '🤍', '💔', '❣️', '💕', '💞', '💓', '💗', '💖'
                ].map((emoji, index) => (
                  <Button
                    key={`${emoji}-${index}`}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEmojiSelect(emoji)}
                    className="h-8 w-8 p-0 text-lg hover:bg-muted"
                  >
                    {emoji}
                  </Button>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEmojiPicker(false)}
                  className="w-full text-xs"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Send button */}
        <Button
          onClick={handleSend}
          disabled={(!content.trim() && attachments.length === 0) || disabled || isLoading || attachments.some(att => att.uploading)}
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