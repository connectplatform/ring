'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { MoreVertical, Edit2, Trash2, Reply, Check, CheckCheck, Clock } from 'lucide-react'
import { Message } from '@/features/chat/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import Image from 'next/image'

interface MessageBubbleProps {
  message: Message
  isOwn: boolean
  showAvatar?: boolean
  onEditAction?: (messageId: string) => void
  onDeleteAction?: (messageId: string) => void
  onReplyAction?: (message: Message) => void
  onReactionAction?: (messageId: string, emoji: string) => void
  className?: string
}

const MessageStatus = ({ status }: { status: Message['status'] }) => {
  const iconClass = "h-3 w-3"
  
  switch (status) {
    case 'sending':
      return <Clock className={cn(iconClass, "text-muted-foreground animate-pulse")} />
    case 'sent':
      return <Check className={cn(iconClass, "text-muted-foreground")} />
    case 'delivered':
      return <CheckCheck className={cn(iconClass, "text-muted-foreground")} />
    case 'read':
      return <CheckCheck className={cn(iconClass, "text-primary")} />
    default:
      return null
  }
}

const MessageReactions = ({ 
  reactions, 
  onReaction 
}: { 
  reactions: Message['reactions'], 
  onReaction?: (emoji: string) => void 
}) => {
  if (!reactions || reactions.length === 0) return null

  // Group reactions by emoji and count them
  const groupedReactions = reactions.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = []
    }
    acc[reaction.emoji].push(reaction)
    return acc
  }, {} as Record<string, typeof reactions>)

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {Object.entries(groupedReactions).map(([emoji, reactionList]) => (
        <Button
          key={emoji}
          variant="outline"
          size="sm"
          className="h-6 px-2 text-xs hover:bg-accent"
          onClick={() => onReaction?.(emoji)}
        >
          <span className="mr-1">{emoji}</span>
          <span>{reactionList.length}</span>
        </Button>
      ))}
    </div>
  )
}

export function MessageBubble({
  message,
  isOwn,
  showAvatar = true,
  onEditAction,
  onDeleteAction,
  onReplyAction,
  onReactionAction,
  className
}: MessageBubbleProps) {
  const isSystemMessage = message.type === 'system'
  
  if (isSystemMessage) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex justify-center my-2"
      >
        <Badge variant="secondary" className="text-xs">
          {message.content}
        </Badge>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex mb-3 group",
        isOwn ? "justify-end" : "justify-start",
        className
      )}
    >
      {/* Avatar for received messages */}
      {!isOwn && showAvatar && (
        <div className="flex-shrink-0 mr-2">
          <div className="h-8 w-8 rounded-full overflow-hidden bg-primary text-primary-foreground flex items-center justify-center text-sm">
            {message.senderAvatar ? (
              <Image 
                src={message.senderAvatar} 
                alt={message.senderName || 'User avatar'} 
                width={32}
                height={32}
                className="w-full h-full object-cover" 
              />
            ) : (
              message.senderName.charAt(0).toUpperCase()
            )}
          </div>
        </div>
      )}

      <div className={cn("max-w-xs lg:max-w-md", isOwn ? "ml-12" : "mr-12")}>
        {/* Sender name for received messages */}
        {!isOwn && (
          <div className="text-xs text-muted-foreground mb-1 ml-3">
            {message.senderName}
          </div>
        )}

        {/* Reply indicator */}
        {message.replyTo && (
          <div className="text-xs text-muted-foreground mb-1 ml-3 italic">
            Replying to message...
          </div>
        )}

        <div className="relative">
          {/* Message bubble */}
          <div
            className={cn(
              "rounded-lg px-3 py-2 text-sm break-words relative",
              isOwn
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            {/* Message content */}
            <div className="pr-6">
              {/* Text content */}
              {message.content && (
                <div className="mb-2">
                  {message.content}
                </div>
              )}
              
              {/* File attachments */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="space-y-2">
                  {message.attachments.map((attachment, index) => (
                    <div key={`${attachment.url}-${index}`} className="border rounded-lg overflow-hidden">
                      {attachment.type === 'image' && (
                        <div>
                          <Image 
                            src={attachment.url} 
                            alt={attachment.name || 'Shared image'} 
                            width={400}
                            height={300}
                            className="max-w-full h-auto rounded"
                          />
                          {attachment.name && (
                            <div className="p-2 bg-muted/50 text-xs">
                              {attachment.name}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {(attachment.type === 'file' || attachment.type === 'document') && (
                        <div className="p-3 flex items-center space-x-3 bg-muted/20">
                          <div className="flex-shrink-0 w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                            📄
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-sm">
                              {attachment.name || 'File attachment'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {attachment.size ? `${(attachment.size / 1024 / 1024).toFixed(1)} MB` : 'Unknown size'}
                            </p>
                          </div>
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 text-xs text-primary hover:underline"
                          >
                            Download
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Legacy support for old message types */}
              {!message.attachments && message.type === 'image' && (
                <div>
                  <Image 
                    src={message.content} 
                    alt="Shared image" 
                    width={400}
                    height={300}
                    className="max-w-full rounded"
                  />
                </div>
              )}
              
              {!message.attachments && message.type === 'file' && (
                <div className="flex items-center space-x-2">
                  <div className="flex-1">
                    <p className="font-medium">File attachment</p>
                    <p className="text-xs opacity-75">{message.content}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Message actions dropdown */}
            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  {onReplyAction && (
                    <DropdownMenuItem onClick={() => onReplyAction(message)}>
                      <Reply className="h-3 w-3 mr-2" />
                      Reply
                    </DropdownMenuItem>
                  )}
                  {isOwn && onEditAction && (
                    <DropdownMenuItem onClick={() => onEditAction(message.id)}>
                      <Edit2 className="h-3 w-3 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {isOwn && onDeleteAction && (
                    <DropdownMenuItem 
                      onClick={() => onDeleteAction(message.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-3 w-3 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Message reactions */}
          {onReactionAction && (
            <MessageReactions 
              reactions={message.reactions} 
              onReaction={(emoji) => onReactionAction(message.id, emoji)}
            />
          )}

          {/* Message metadata */}
          <div className={cn(
            "flex items-center mt-1 space-x-1 text-xs text-muted-foreground",
            isOwn ? "justify-end" : "justify-start"
          )}>
            <span>
              {new Date(message.timestamp.toMillis()).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
            {message.editedAt && (
              <span className="italic">(edited)</span>
            )}
            {isOwn && <MessageStatus status={message.status} />}
          </div>
        </div>
      </div>
    </motion.div>
  )
} 