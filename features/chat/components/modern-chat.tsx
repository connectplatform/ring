/**
 * Modern Chat Component using WebSocket Push Architecture
 * Replaces polling with real-time push notifications
 */

'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Send, Users, Loader2, ArrowLeft, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useTranslations } from 'next-intl'
import { useWebSocketMessages, useWebSocket } from '@/hooks/use-websocket'
import { ConversationList } from '@/features/chat/components/conversation-list'
import { MessageThread } from '@/features/chat/components/message-thread'
import { ConversationHeader } from '@/features/chat/components/conversation-header'
import { Conversation, CreateConversationRequest } from '@/features/chat/types'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface ModernChatProps {
  entityId?: string
  entityName?: string
  entityCreatorId?: string
  opportunityId?: string
  opportunityName?: string
  className?: string
  // New props for direct messaging
  targetUserId?: string
  targetUserName?: string
  // Layout control
  showConversationList?: boolean
  initialConversationId?: string
}

interface MessagingState {
  selectedConversationId: string | null
  showMobileConversationList: boolean
  isCreatingConversation: boolean
  conversations: Conversation[]
}

function ModernChatContent({ 
  entityId, 
  entityName, 
  entityCreatorId, 
  opportunityId, 
  opportunityName, 
  targetUserId,
  targetUserName,
  className,
  showConversationList = true,
  initialConversationId
}: ModernChatProps) {
  const t = useTranslations('modules.messenger')
  const { data: session, status } = useSession()
  
  // Use modern WebSocket hooks
  const { isConnected, status: wsStatus } = useWebSocket()
  
  // Component state
  const [state, setState] = useState<MessagingState>({
    selectedConversationId: initialConversationId || null,
    showMobileConversationList: true,
    isCreatingConversation: false,
    conversations: []
  })
  
  // Generate conversation ID for entity/opportunity chat
  const conversationId = React.useMemo(() => {
    if (entityId) {
      return opportunityId 
        ? `entity-${entityId}-opportunity-${opportunityId}`
        : `entity-${entityId}`
    }
    if (targetUserId) {
      return `direct-${session?.user?.id}-${targetUserId}`
    }
    return state.selectedConversationId
  }, [entityId, opportunityId, targetUserId, session?.user?.id, state.selectedConversationId])

  // Use modern WebSocket messages hook
  const {
    messages,
    typingUsers,
    sendMessage,
    startTyping,
    stopTyping
  } = useWebSocketMessages(conversationId || '')

  // Auto-connect to conversation channel
  useEffect(() => {
    if (conversationId && isConnected) {
      // Subscribe to the conversation channel via WebSocket
      console.log(`📬 Joining conversation: ${conversationId}`)
    }
  }, [conversationId, isConnected])

  // Handle new messages
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      
      // Show notification for new messages from others
      if (lastMessage.senderId !== session?.user?.id) {
        toast({
          title: '💬 New message',
          description: `From ${lastMessage.senderName || 'User'}: ${lastMessage.content?.substring?.(0, 50) || 'New message'}...`,
        })
      }
    }
  }, [messages, session?.user?.id])

  // Connection status display
  const getConnectionStatus = () => {
    if (!isConnected) {
      return (
        <Alert className="m-4 border-amber-200 bg-amber-50">
          <AlertDescription className="text-sm text-amber-800">
            <div className="flex items-center">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t('reconnecting') || 'Reconnecting to chat server...'}
            </div>
          </AlertDescription>
        </Alert>
      )
    }
    
    return (
      <div className="flex items-center justify-center p-2">
        <div className="flex items-center text-xs text-green-600">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
          Real-time chat active
        </div>
      </div>
    )
  }

  // Message input with typing indicators
  const MessageInput = ({ onSendMessage }: { onSendMessage: (message: string) => void }) => {
    const [message, setMessage] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const typingTimeoutRef = React.useRef<NodeJS.Timeout | undefined>(undefined)

    const handleInputChange = (value: string) => {
      setMessage(value)
      
      // Handle typing indicators
      if (value.length > 0 && !isTyping) {
        setIsTyping(true)
        startTyping()
      }
      
      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      
      // Set timeout to stop typing
      typingTimeoutRef.current = setTimeout(() => {
        if (isTyping) {
          setIsTyping(false)
          stopTyping()
        }
      }, 1000)
    }

    const handleSend = () => {
      if (!message.trim() || !isConnected) return
      
      onSendMessage(message.trim())
      setMessage('')
      
      // Stop typing indicator
      if (isTyping) {
        setIsTyping(false)
        stopTyping()
      }
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    }

    return (
      <div className="border-t p-4">
        {/* Typing indicators */}
        {typingUsers.length > 0 && (
          <div className="mb-2 text-xs text-gray-500">
            {typingUsers.length === 1 
              ? `${typingUsers[0]} is typing...`
              : `${typingUsers.length} people are typing...`
            }
          </div>
        )}
        
        <div className="flex items-end space-x-2">
          <textarea
            value={message}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isConnected ? "Type your message..." : "Connecting..."}
            disabled={!isConnected}
            className="flex-1 min-h-[40px] max-h-[120px] p-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || !isConnected}
            size="sm"
            className="px-3 py-2"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  const renderChatHeader = () => {
    const title = entityName 
      ? `Chat about ${entityName}${opportunityName ? ` - ${opportunityName}` : ''}`
      : targetUserName 
      ? `Chat with ${targetUserName}`
      : 'Chat'

    return (
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center">
            <MessageCircle className="h-5 w-5 mr-2" />
            {title}
          </div>
          <div className="flex items-center space-x-2">
            {isConnected && (
              <Badge variant="outline" className="text-xs bg-green-50 border-green-200">
                ✓ Connected
              </Badge>
            )}
            {typingUsers.length > 0 && (
              <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200">
                <Users className="h-3 w-3 mr-1" />
                {typingUsers.length}
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
    )
  }

  const renderMessages = () => {
    if (messages.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Start the conversation
            </h3>
            <p className="text-gray-500">
              {entityName 
                ? `Ask questions about ${entityName} or start a discussion.`
                : 'Send your first message to begin chatting.'
              }
            </p>
          </div>
        </div>
      )
    }

    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={cn(
                "flex",
                message.senderId === session?.user?.id ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[70%] rounded-lg p-3",
                  message.senderId === session?.user?.id
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-900"
                )}
              >
                {message.senderId !== session?.user?.id && (
                  <div className="text-xs opacity-70 mb-1">
                    {message.senderName || 'User'}
                  </div>
                )}
                <div className="break-words">{message.content}</div>
                <div className="text-xs opacity-70 mt-1">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    )
  }

  // Don't render if not authenticated
  if (status !== 'authenticated') {
    return (
      <Alert>
        <AlertDescription>
          Please sign in to access chat functionality.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Card className={cn("h-[600px] flex flex-col", className)}>
      {renderChatHeader()}
      
      {getConnectionStatus()}
      
      <CardContent className="flex-1 flex flex-col p-0">
        {renderMessages()}
        <MessageInput onSendMessage={sendMessage} />
      </CardContent>
    </Card>
  )
}

export default function ModernChat(props: ModernChatProps) {
  return <ModernChatContent {...props} />
}

// Export for backward compatibility
export { ModernChat }
