'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Paperclip, Image as ImageIcon, Smile, X, Loader2, Receipt, ListTodo, BarChart3, CalendarDays, Gamepad2, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { useTyping } from '@/hooks/use-messaging'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { Message, SendMessageRequest } from '@/features/chat/types'
import type { MediaDerivatives } from '@/lib/file/interfaces/IFileService'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

interface MessageComposerProps {
  conversationId: string
  onMessageSentAction?: (message: Message) => void
  onSendMessageAction?: (content: string, options?: Partial<SendMessageRequest>) => Promise<Message | null>
  /** Opens native-token payment request flow (direct chats). */
  onRequestPaymentAction?: () => void
  /** Opens task compose dialog for this conversation. */
  onCreateTaskAction?: () => void
  /** Opens poll compose dialog. */
  onCreatePollAction?: () => void
  /** Opens RSVP compose dialog when conversation has entity/group binding. */
  onCreateRsvpAction?: () => void
  /** Opens peer game challenge dialog (direct chats). */
  onCreateGameAction?: () => void
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
  fileId?: string
  derivatives?: MediaDerivatives
}

export function MessageComposer({
  conversationId,
  onMessageSentAction,
  onSendMessageAction,
  onRequestPaymentAction,
  onCreateTaskAction,
  onCreatePollAction,
  onCreateRsvpAction,
  onCreateGameAction,
  placeholder,
  disabled = false,
  className,
  replyTo,
  onCancelReplyAction
}: MessageComposerProps) {
  const t = useTranslations('modules.messenger')
  const inputPlaceholder = placeholder || t('composerPlaceholder')
  const draftKey = `draft_${conversationId}`
  const [content, setContent] = useLocalStorage<string>(draftKey, '')
  const [isLoading, setIsLoading] = useState(false)
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const { startTyping, stopTyping } = useTyping(conversationId)

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
        title: t('composerWait'),
        description: t('composerUploading'),
        variant: 'default'
      })
      return
    }

    // Check if any attachments have errors
    if (attachments.some(att => att.error)) {
      toast({
        title: t('composerUploadErrors'),
        description: t('composerRemoveFailed'),
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
          type: att.type === 'image' ? 'image' : att.type === 'video' || att.type === 'audio' ? 'file' : 'document',
          ...(att.fileId ? { fileId: att.fileId } : {}),
          ...(att.derivatives ? { derivatives: att.derivatives } : {}),
        }))
      }

      const sentMessage = await onSendMessageAction(content.trim(), messageOptions)
      
      if (sentMessage) {
        setContent('')
        setAttachments([])
        onMessageSentAction?.(sentMessage)
        onCancelReplyAction?.()
        
        // Focus back to textarea
        textareaRef.current?.focus()
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      toast({
        title: t('composerSendFailed'),
        description: t('composerSendFailedHint'),
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
      formData.append('purpose', 'chat:attachment')

      const response = await fetch('/api/uploads', {
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
          ? {
              ...att,
              uploading: false,
              uploadProgress: 100,
              url: data.url,
              ...(typeof data.fileId === 'string' ? { fileId: data.fileId } : {}),
              ...(data.derivatives ? { derivatives: data.derivatives } : {}),
            }
          : att
      ))

      return data.url
    } catch (error) {
      console.error('Error uploading file:', error)
      
      setAttachments(prev => prev.map(att => 
        att.id === attachment.id 
          ? { ...att, uploading: false, error: error instanceof Error ? error.message : t('uploadFailed') }
          : att
      ))

      toast({
        title: t('uploadFailed'),
        description: error instanceof Error ? error.message : t('uploadFailedHint'),
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
          title: t('fileTooLarge'),
          description: t('fileTooLargeHint', { name: file.name }),
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
  const [attachOpen, setAttachOpen] = useState(false)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const attachMenuRef = useRef<HTMLDivElement>(null)

  const handleEmojiSelect = (emoji: string) => {
    setContent(prev => prev + emoji)
    setShowEmojiPicker(false)
    textareaRef.current?.focus()
  }

  // Close emoji picker and attach menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(target)) {
        setShowEmojiPicker(false)
      }
      if (attachMenuRef.current && !attachMenuRef.current.contains(target)) {
        setAttachOpen(false)
      }
    }

    if (showEmojiPicker || attachOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showEmojiPicker, attachOpen])

  const attachItems: Array<{
    key: string
    label: string
    icon: React.ReactNode
    onSelect: () => void
  }> = [
    {
      key: 'file',
      label: t('attachFile'),
      icon: <Paperclip className="h-5 w-5" />,
      onSelect: handleFileUpload,
    },
    {
      key: 'photo',
      label: t('attachPhoto'),
      icon: <ImageIcon className="h-5 w-5" aria-hidden focusable="false" />,
      onSelect: handleImageUpload,
    },
  ]
  if (onRequestPaymentAction) {
    attachItems.push({
      key: 'payment',
      label: t('attachPayment'),
      icon: <Receipt className="h-5 w-5" />,
      onSelect: onRequestPaymentAction,
    })
  }
  if (onCreateTaskAction) {
    attachItems.push({
      key: 'task',
      label: t('attachTask'),
      icon: <ListTodo className="h-5 w-5" />,
      onSelect: onCreateTaskAction,
    })
  }
  if (onCreatePollAction) {
    attachItems.push({
      key: 'poll',
      label: t('attachPoll'),
      icon: <BarChart3 className="h-5 w-5" />,
      onSelect: onCreatePollAction,
    })
  }
  if (onCreateRsvpAction) {
    attachItems.push({
      key: 'rsvp',
      label: t('attachRsvp'),
      icon: <CalendarDays className="h-5 w-5" />,
      onSelect: onCreateRsvpAction,
    })
  }
  if (onCreateGameAction) {
    attachItems.push({
      key: 'game',
      label: t('attachGame'),
      icon: <Gamepad2 className="h-5 w-5" />,
      onSelect: onCreateGameAction,
    })
  }
  attachItems.push({
    key: 'emoji',
    label: t('attachEmoji'),
    icon: <Smile className="h-5 w-5" />,
    onSelect: () => setShowEmojiPicker(true),
  })

  const canSend =
    (content.trim().length > 0 || attachments.length > 0) &&
    !disabled &&
    !isLoading &&
    !attachments.some((att) => att.uploading)

  return (
    <div className={cn('bg-transparent p-[5px]', className)}>
      {replyTo && (
        <div className="mb-2 rounded-lg bg-muted/80 p-2 text-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-muted-foreground">{t('composerReplyingTo')} </span>
              <span className="font-medium">{replyTo.senderName}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancelReplyAction}
              className="h-8 w-8 p-0"
            >
              ×
            </Button>
          </div>
          <div className="mt-1 truncate text-muted-foreground">{replyTo.content}</div>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="mb-3 space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between rounded-lg bg-muted p-2"
            >
              <div className="flex min-w-0 flex-1 items-center space-x-2">
                <div className="flex-shrink-0">
                  {attachment.type === 'image' && (
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-100">
                      <ImageIcon className="h-4 w-4 text-blue-600" />
                    </div>
                  )}
                  {attachment.type === 'file' && (
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-100">
                      <Paperclip className="h-4 w-4 text-gray-600" />
                    </div>
                  )}
                  {(attachment.type === 'video' || attachment.type === 'audio') && (
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-purple-100">
                      <Paperclip className="h-4 w-4 text-purple-600" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{attachment.file.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {(attachment.file.size / 1024 / 1024).toFixed(1)} MB
                  </div>
                  {attachment.uploading && (
                    <Progress value={attachment.uploadProgress} className="mt-1 h-1" />
                  )}
                  {attachment.error && (
                    <div className="mt-1 text-xs text-red-500">{attachment.error}</div>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-1">
                {attachment.uploading && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAttachment(attachment.id)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

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

      <div className="relative flex items-end gap-2" ref={attachMenuRef}>
        {attachOpen && (
          <div
            className="absolute bottom-full left-0 z-20 mb-2 w-[min(100%,20rem)] origin-bottom animate-in slide-in-from-bottom-2 overflow-hidden rounded-2xl border bg-background shadow-lg"
            role="menu"
            aria-label={t('composerAttach')}
          >
            {attachItems.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                disabled={disabled || isLoading}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted disabled:opacity-50"
                onClick={() => {
                  setAttachOpen(false)
                  item.onSelect()
                }}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAttachOpen((open) => !open)}
          disabled={disabled || isLoading}
          className="h-11 w-11 shrink-0 rounded-full p-0"
          aria-label={t('composerAttach')}
          aria-expanded={attachOpen}
        >
          <Plus className={cn('h-5 w-5 transition-transform', attachOpen && 'rotate-45')} />
        </Button>

        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={inputPlaceholder}
          disabled={disabled || isLoading}
          className="min-h-[44px] max-h-[120px] flex-1 resize-none rounded-2xl border bg-background/80 px-3 py-2.5 shadow-none outline-none ring-0 focus-visible:ring-0"
          rows={1}
          aria-label={inputPlaceholder}
        />

        <Button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          size="sm"
          className={cn(
            'h-11 w-11 shrink-0 rounded-full p-0',
            canSend
              ? 'bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-indigo-500'
              : 'bg-muted text-muted-foreground',
          )}
          aria-label={t('composerSend')}
        >
          {isLoading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>

        {showEmojiPicker && (
          <div
            ref={emojiPickerRef}
            className="absolute bottom-14 right-0 z-10 w-64 rounded-lg border bg-background p-3 shadow-lg"
          >
            <div className="grid max-h-48 grid-cols-8 gap-1 overflow-y-auto">
              {[
                '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
                '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
                '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜',
                '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏',
                '👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟',
                '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️',
                '❤️', '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤',
                '🤍', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
              ].map((emoji, index) => (
                <Button
                  key={`${emoji}-${index}`}
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEmojiSelect(emoji)}
                  className="h-9 w-9 p-0 text-lg hover:bg-muted"
                >
                  {emoji}
                </Button>
              ))}
            </div>
            <div className="mt-2 border-t pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEmojiPicker(false)}
                className="w-full text-xs"
              >
                {t('composerClose')}
              </Button>
            </div>
          </div>
        )}
      </div>

      <p className="sr-only">{t('composerHint')}</p>
    </div>
  )
} 