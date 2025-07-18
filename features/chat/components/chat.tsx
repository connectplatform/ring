'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useOptimistic } from 'react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Send, Users, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useTranslation } from 'react-i18next'
import { useConversation, useMessages } from '@/hooks/use-messaging'
import { useWebSocket } from '@/hooks/use-websocket'
import { MessageBubble } from '@/components/messaging/message-bubble'
import { MessageComposer } from '@/components/messaging/message-composer'
import { TypingIndicator } from '@/components/messaging/typing-indicator'
import { ConversationHeader } from '@/components/messaging/conversation-header'
import { Message } from '@/features/chat/types'
import { toast } from '@/hooks/use-toast'

interface ChatProps {
  entityId: string
  entityName: string
  entityCreatorId: string
  opportunityId?: string
  opportunityName?: string
  className?: string
}

interface ConversationData {
  id: string
  type: 'entity' | 'opportunity'
  title: string
  participants: string[]
  isActive: boolean
}

function ChatContent({ entityId, entityName, entityCreatorId, opportunityId, opportunityName, className }: ChatProps) {
  const { t } = useTranslation()
  const { data: session, status } = useSession()
  const [conversationData, setConversationData] = useState<ConversationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const { isConnected } = useWebSocket()
  
  // Create or find conversation based on entity/opportunity
  const conversationId = conversationData?.id || ''
  const { conversation, markAsRead } = useConversation(conversationId)
  const { messages, sendMessage: sendMessageHook, loading: messagesLoading } = useMessages(conversationId)

  // Optimistic updates for better UX
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (currentMessages: Message[], newMessage: Message) => [...currentMessages, newMessage]
  )

  // Create or find conversation on component mount
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return

    const initializeConversation = async () => {
      try {
        setLoading(true)
        setError(null)

        // Try to find existing conversation first
        const conversationType = opportunityId ? 'opportunity' : 'entity'
        const conversationTitle = opportunityName ? `${entityName} - ${opportunityName}` : entityName
        
        // Check if conversation already exists
        const existingResponse = await fetch(`/api/conversations?type=${conversationType}&entityId=${entityId}${opportunityId ? `&opportunityId=${opportunityId}` : ''}`)
        
        if (existingResponse.ok) {
          const existingData = await existingResponse.json()
          if (existingData.data && existingData.data.length > 0) {
            setConversationData({
              id: existingData.data[0].id,
              type: conversationType,
              title: conversationTitle,
              participants: existingData.data[0].participants.map((p: any) => p.userId),
              isActive: existingData.data[0].isActive
            })
            return
          }
        }

        // Create new conversation if none exists
        const createResponse = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: conversationType,
            title: conversationTitle,
            participants: [
              { userId: session.user.id, role: 'member' },
              { userId: entityCreatorId, role: 'admin' }
            ],
            entityId,
            opportunityId,
            metadata: {
              entityName,
              entityCreatorId,
              opportunityName: opportunityName || null
            }
          })
        })

        if (!createResponse.ok) {
          throw new Error('Failed to create conversation')
        }

        const newConversation = await createResponse.json()
        setConversationData({
          id: newConversation.data.id,
          type: conversationType,
          title: conversationTitle,
          participants: newConversation.data.participants.map((p: any) => p.userId),
          isActive: true
        })

      } catch (err) {
        console.error('Error initializing conversation:', err)
        setError(err instanceof Error ? err.message : 'Failed to initialize chat')
        toast({
          title: 'Chat Error',
          description: 'Failed to initialize chat. Please try again.',
          variant: 'destructive'
        })
      } finally {
        setLoading(false)
      }
    }

    initializeConversation()
  }, [status, session, entityId, entityCreatorId, opportunityId, entityName, opportunityName])

  // Handle message sending
  const handleSendMessage = useCallback(async (content: string): Promise<Message | null> => {
    if (!session?.user?.id || !conversationData?.id) return null

    try {
      // Optimistic update
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        conversationId: conversationData.id,
        senderId: session.user.id,
        senderName: session.user.name || 'You',
        senderAvatar: session.user.image || undefined,
        content,
        type: 'text',
        status: 'sending',
        timestamp: new Date() as any,
        reactions: []
      }

      addOptimisticMessage(optimisticMessage)

      // Send message via hook
      await sendMessageHook(content)

      // Mark conversation as read
      await markAsRead()

      return optimisticMessage

    } catch (err) {
      console.error('Error sending message:', err)
      toast({
        title: 'Message Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive'
      })
      return null
    }
  }, [session, conversationData, sendMessageHook, markAsRead, addOptimisticMessage])

  // Loading state
  if (status === 'loading' || loading) {
    return (
      <Card className={`w-full max-w-2xl mx-auto ${className}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-muted-foreground">{t('loadingChat') || 'Loading chat...'}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Authentication required
  if (status === 'unauthenticated') {
    return (
      <Alert className={className}>
        <MessageCircle className="h-4 w-4" />
        <AlertDescription>
          {t('signInToChat') || 'Please sign in to access the chat.'}
        </AlertDescription>
      </Alert>
    )
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <MessageCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  // No conversation data
  if (!conversationData) {
    return (
      <Alert className={className}>
        <MessageCircle className="h-4 w-4" />
        <AlertDescription>
          {t('noConversation') || 'Unable to load conversation.'}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Card className={`w-full max-w-2xl mx-auto ${className}`}>
      {/* Conversation Header */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            {conversationData.title}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? 'Connected' : 'Connecting...'}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {conversationData.participants.length}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Messages */}
        <ScrollArea className="h-96 w-full rounded-md border p-4">
          <div className="space-y-4">
            <AnimatePresence>
              {optimisticMessages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwn={message.senderId === session?.user?.id}
                />
              ))}
            </AnimatePresence>
            
            {/* Typing Indicator */}
            {conversationData.id && (
              <TypingIndicator conversationId={conversationData.id} />
            )}
          </div>
        </ScrollArea>

        {/* Message Input */}
        <MessageComposer
          conversationId={conversationData.id}
          onSendMessageAction={handleSendMessage}
          disabled={!isConnected}
          placeholder={t('typeMessage') || 'Type a message...'}
        />

        {/* Connection Status */}
        {!isConnected && (
          <Alert>
            <AlertDescription className="text-sm">
              {t('reconnecting') || 'Reconnecting to chat server...'}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

export default function Chat(props: ChatProps) {
  return <ChatContent {...props} />
} 