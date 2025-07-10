'use client'

import React from 'react'
import { MoreVertical, Info, Archive, LogOut, Users, Circle } from 'lucide-react'
import { Conversation } from '@/features/chat/types'
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

interface ConversationHeaderProps {
  conversation: Conversation
  currentUserId: string
  onInfoClickAction?: () => void
  onArchiveAction?: () => void
  onLeaveAction?: () => void
  className?: string
}

export function ConversationHeader({
  conversation,
  currentUserId,
  onInfoClickAction,
  onArchiveAction,
  onLeaveAction,
  className
}: ConversationHeaderProps) {
  const getConversationTitle = () => {
    if (conversation.type === 'entity' && conversation.metadata.entityName) {
      return conversation.metadata.entityName
    }
    
    if (conversation.type === 'opportunity' && conversation.metadata.opportunityName) {
      return `${conversation.metadata.entityName} - ${conversation.metadata.opportunityName}`
    }
    
    if (conversation.type === 'direct') {
      // For direct conversations, show the other participant's name
      const otherParticipant = conversation.participants.find(p => p.userId !== currentUserId)
      return otherParticipant ? `Direct with ${otherParticipant.userId}` : 'Direct conversation'
    }
    
    return 'Conversation'
  }

  const getConversationSubtitle = () => {
    const participantCount = conversation.participants.length
    const onlineCount = conversation.participants.filter(p => p.isOnline).length
    
    if (conversation.type === 'direct') {
      const otherParticipant = conversation.participants.find(p => p.userId !== currentUserId)
      return otherParticipant?.isOnline ? 'Online' : 'Offline'
    }
    
    return `${participantCount} participant${participantCount !== 1 ? 's' : ''} • ${onlineCount} online`
  }

  const getTypeIcon = () => {
    switch (conversation.type) {
      case 'entity':
        return '🏢'
      case 'opportunity':
        return '💼'
      case 'direct':
        return '👤'
      default:
        return '💬'
    }
  }

  const getOnlineStatus = () => {
    if (conversation.type === 'direct') {
      const otherParticipant = conversation.participants.find(p => p.userId !== currentUserId)
      return otherParticipant?.isOnline
    }
    return conversation.participants.some(p => p.isOnline && p.userId !== currentUserId)
  }

  return (
    <div className={cn(
      "flex items-center justify-between p-4 border-b bg-background",
      className
    )}>
      <div className="flex items-center space-x-3 min-w-0 flex-1">
        {/* Conversation type icon */}
        <div className="flex-shrink-0 text-lg">
          {getTypeIcon()}
        </div>

        {/* Conversation info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-2">
            <h3 className="font-semibold text-sm truncate">
              {getConversationTitle()}
            </h3>
            
            {/* Online status indicator */}
            {getOnlineStatus() && (
              <Circle className="h-2 w-2 fill-green-500 text-green-500" />
            )}
            
            {/* Conversation type badge */}
            <Badge variant="secondary" className="text-xs">
              {conversation.type}
            </Badge>
          </div>
          
          <p className="text-xs text-muted-foreground truncate">
            {getConversationSubtitle()}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center space-x-1">
        {/* Participants info button */}
        {conversation.participants.length > 2 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onInfoClickAction}
            className="h-8 w-8 p-0"
          >
            <Users className="h-4 w-4" />
          </Button>
        )}

        {/* More actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {onInfoClickAction && (
              <DropdownMenuItem onClick={onInfoClickAction}>
                <Info className="h-4 w-4 mr-2" />
                Conversation info
              </DropdownMenuItem>
            )}
            
            {onArchiveAction && (
              <DropdownMenuItem onClick={onArchiveAction}>
                <Archive className="h-4 w-4 mr-2" />
                Archive conversation
              </DropdownMenuItem>
            )}
            
            {onLeaveAction && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={onLeaveAction}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Leave conversation
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
} 