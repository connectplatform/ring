'use client'

import React, { useState, useMemo } from 'react'
import { Search, Plus, Circle } from 'lucide-react'
import { useConversations } from '@/hooks/use-messaging'
import { Conversation } from '@/features/chat/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface ConversationListProps {
  userId: string
  onConversationSelectAction: (conversationId: string) => void
  selectedConversationId?: string
  onNewConversationAction?: () => void
  className?: string
}

interface ConversationItemProps {
  conversation: Conversation
  isSelected: boolean
  onClick: () => void
  currentUserId: string
}

const ConversationItem = ({ 
  conversation, 
  isSelected, 
  onClick, 
  currentUserId 
}: ConversationItemProps) => {
  const getConversationTitle = () => {
    if (conversation.type === 'entity' && conversation.metadata.entityName) {
      return conversation.metadata.entityName
    }
    
    if (conversation.type === 'opportunity' && conversation.metadata.opportunityName) {
      return conversation.metadata.opportunityName
    }
    
    if (conversation.type === 'direct') {
      const otherParticipant = conversation.participants.find(p => p.userId !== currentUserId)
      return otherParticipant ? `${otherParticipant.userId}` : 'Direct'
    }
    
    return 'Conversation'
  }

  const getLastMessagePreview = () => {
    if (!conversation.lastMessage) {
      return 'No messages yet'
    }
    
    const { content, type, senderId } = conversation.lastMessage
    const isOwn = senderId === currentUserId
    const prefix = isOwn ? 'You: ' : ''
    
    switch (type) {
      case 'image':
        return `${prefix}📷 Image`
      case 'file':
        return `${prefix}📎 File`
      case 'system':
        return content
      default:
        return `${prefix}${content}`
    }
  }

  const getUnreadCount = () => {
    // TODO: Calculate unread count based on lastReadAt timestamps
    // For now, return 0
    return 0
  }

  const isOnline = conversation.participants
    .filter(p => p.userId !== currentUserId)
    .some(p => p.isOnline)

  const formatTime = (timestamp: any) => {
    const date = new Date(timestamp.toMillis())
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'now'
    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`
    return date.toLocaleDateString()
  }

  const unreadCount = getUnreadCount()

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors",
        "hover:bg-accent/50",
        isSelected && "bg-accent"
      )}
    >
      {/* Conversation type icon */}
      <div className="flex-shrink-0 relative">
        <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
          {conversation.type === 'entity' ? '🏢' : 
           conversation.type === 'opportunity' ? '💼' : '👤'}
        </div>
        {isOnline && (
          <Circle className="absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-green-500 text-green-500" />
        )}
      </div>

      {/* Conversation info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm truncate">
            {getConversationTitle()}
          </h4>
          <div className="flex items-center space-x-1">
            {conversation.lastMessage && (
              <span className="text-xs text-muted-foreground">
                {formatTime(conversation.lastMessage.timestamp)}
              </span>
            )}
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs h-5 min-w-5 px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-muted-foreground truncate">
            {getLastMessagePreview()}
          </p>
          <Badge variant="outline" className="text-xs ml-2">
            {conversation.type}
          </Badge>
        </div>
      </div>
    </div>
  )
}

export function ConversationList({
  userId,
  onConversationSelectAction,
  selectedConversationId,
  onNewConversationAction,
  className
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const { conversations, loading, error } = useConversations()

  // Filter conversations based on search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations

    return conversations.filter(conversation => {
      const title = conversation.type === 'entity' ? conversation.metadata.entityName :
                   conversation.type === 'opportunity' ? conversation.metadata.opportunityName :
                   'Direct conversation'
      
      const lastMessageContent = conversation.lastMessage?.content || ''
      
      return title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
             lastMessageContent.toLowerCase().includes(searchQuery.toLowerCase())
    })
  }, [conversations, searchQuery])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
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
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Messages</h2>
          {onNewConversationAction && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onNewConversationAction}
              className="h-8 w-8 p-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Conversations list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No conversations found' : 'No conversations yet'}
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
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
} 