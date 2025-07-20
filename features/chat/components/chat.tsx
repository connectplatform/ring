'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Send, Users, Loader2, ArrowLeft, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useTranslation } from 'react-i18next'
import { useConversations, useConversation, useMessages } from '@/hooks/use-messaging'
import { useWebSocket } from '@/hooks/use-websocket'
import { ConversationList } from '@/components/messaging/conversation-list'
import { MessageThread } from '@/components/messaging/message-thread'
import { ConversationHeader } from '@/components/messaging/conversation-header'
import { Conversation, CreateConversationRequest } from '@/features/chat/types'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface ChatProps {
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
}

function ChatContent({ 
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
}: ChatProps) {
  const { t } = useTranslation()
  const { data: session, status } = useSession()
  const { isConnected } = useWebSocket()
  
  // Component state
  const [state, setState] = useState<MessagingState>({
    selectedConversationId: initialConversationId || null,
    showMobileConversationList: true,
    isCreatingConversation: false
  })
  
  // Messaging hooks
  const { conversations, loading: conversationsLoading, createConversation } = useConversations()
  const { conversation: selectedConversation } = useConversation(state.selectedConversationId || '')

  // Auto-select or create conversation based on props
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return
    if (state.selectedConversationId) return // Already have a selection

    const autoSelectOrCreateConversation = async () => {
      setState(prev => ({ ...prev, isCreatingConversation: true }))

      try {
        // Case 1: Entity/Opportunity conversation
        if (entityId) {
          const existingConversation = conversations.find(conv => 
            conv.type === (opportunityId ? 'opportunity' : 'entity') &&
            conv.metadata.entityId === entityId &&
            (!opportunityId || conv.metadata.opportunityId === opportunityId)
          )

          if (existingConversation) {
            setState(prev => ({ 
              ...prev, 
              selectedConversationId: existingConversation.id,
              showMobileConversationList: false 
            }))
            return
          }

                     // Create new entity/opportunity conversation
           if (entityCreatorId) {
             const conversationData: CreateConversationRequest = {
               type: opportunityId ? 'opportunity' : 'entity',
               participantIds: [session.user.id, entityCreatorId],
               metadata: {
                 entityId,
                 entityName,
                 opportunityId,
                 opportunityName
               }
             }

            const newConversation = await createConversation(conversationData)
            if (newConversation) {
              setState(prev => ({ 
                ...prev, 
                selectedConversationId: newConversation.id,
                showMobileConversationList: false 
              }))
            }
          }
        }
        // Case 2: Direct user conversation
        else if (targetUserId) {
          const existingConversation = conversations.find(conv => 
            conv.type === 'direct' &&
            conv.participants.some(p => p.userId === targetUserId)
          )

          if (existingConversation) {
            setState(prev => ({ 
              ...prev, 
              selectedConversationId: existingConversation.id,
              showMobileConversationList: false 
            }))
            return
          }

                     // Create new direct conversation
           const conversationData: CreateConversationRequest = {
             type: 'direct',
             participantIds: [session.user.id, targetUserId],
             metadata: {
               // Store target user info in entity fields for direct conversations
               entityId: targetUserId,
               entityName: targetUserName
             }
           }

          const newConversation = await createConversation(conversationData)
          if (newConversation) {
            setState(prev => ({ 
              ...prev, 
              selectedConversationId: newConversation.id,
              showMobileConversationList: false 
            }))
          }
        }
        // Case 3: Show conversation list for general messaging
        else if (conversations.length > 0 && showConversationList) {
          // Auto-select first conversation if none specified
          setState(prev => ({ 
            ...prev, 
            selectedConversationId: conversations[0].id,
            showMobileConversationList: false 
          }))
        }

      } catch (error) {
        console.error('Error auto-selecting conversation:', error)
        toast({
          title: 'Chat Error',
          description: 'Failed to initialize chat. Please try again.',
          variant: 'destructive'
        })
      } finally {
        setState(prev => ({ ...prev, isCreatingConversation: false }))
      }
    }

    if (!conversationsLoading) {
      autoSelectOrCreateConversation()
    }
  }, [
    status, session, conversations, conversationsLoading, createConversation,
    entityId, entityName, entityCreatorId, opportunityId, opportunityName,
    targetUserId, targetUserName, showConversationList, state.selectedConversationId
  ])

  // Event handlers
  const handleConversationSelect = useCallback((conversationId: string) => {
    setState(prev => ({ 
      ...prev, 
      selectedConversationId: conversationId,
      showMobileConversationList: false 
    }))
  }, [])

  const handleBackToList = useCallback(() => {
    setState(prev => ({ ...prev, showMobileConversationList: true }))
  }, [])

  const handleNewConversation = useCallback(() => {
    // TODO: Implement new conversation modal/flow
    toast({
      title: 'Coming Soon',
      description: 'New conversation creation coming soon!'
    })
  }, [])

  // Message actions
  const handleMessageEdit = useCallback(async (messageId: string, newContent: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent })
      })

      if (!response.ok) {
        throw new Error('Failed to edit message')
      }

      toast({
        title: 'Message Updated',
        description: 'Your message has been updated successfully.'
      })
    } catch (error) {
      console.error('Error editing message:', error)
      toast({
        title: 'Edit Failed',
        description: 'Failed to edit message. Please try again.',
        variant: 'destructive'
      })
    }
  }, [])

  const handleMessageDelete = useCallback(async (messageId: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete message')
      }

      toast({
        title: 'Message Deleted',
        description: 'Your message has been deleted.'
      })
    } catch (error) {
      console.error('Error deleting message:', error)
      toast({
        title: 'Delete Failed',
        description: 'Failed to delete message. Please try again.',
        variant: 'destructive'
      })
    }
  }, [])

  const handleMessageReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji })
      })

      if (!response.ok) {
        throw new Error('Failed to add reaction')
      }
    } catch (error) {
      console.error('Error adding reaction:', error)
      toast({
        title: 'Reaction Failed',
        description: 'Failed to add reaction. Please try again.',
        variant: 'destructive'
      })
    }
  }, [])

  // Loading state
  if (status === 'loading' || conversationsLoading || state.isCreatingConversation) {
    return (
      <Card className={cn("w-full max-w-4xl mx-auto", className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-muted-foreground">
              {t('loadingChat') || 'Loading chat...'}
            </span>
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

  // No session user
  if (!session?.user?.id) {
    return (
      <Alert variant="destructive" className={className}>
        <MessageCircle className="h-4 w-4" />
        <AlertDescription>
          {t('authError') || 'Authentication error. Please refresh the page.'}
        </AlertDescription>
      </Alert>
    )
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  // Render layout based on screen size and conversation selection
  const renderMobileLayout = () => (
    <Card className={cn("w-full h-[600px]", className)}>
      <AnimatePresence mode="wait">
        {state.showMobileConversationList ? (
          <motion.div
            key="conversation-list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="h-full"
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                {t('messages') || 'Messages'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 h-[calc(100%-80px)]">
              <ConversationList
                userId={session.user.id}
                onConversationSelectAction={handleConversationSelect}
                selectedConversationId={state.selectedConversationId}
                onNewConversationAction={handleNewConversation}
              />
            </CardContent>
          </motion.div>
        ) : state.selectedConversationId ? (
          <motion.div
            key="message-thread"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="h-full flex flex-col"
          >
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleBackToList}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                {selectedConversation && (
                  <ConversationHeader
                    conversation={selectedConversation}
                    currentUserId={session.user.id}
                    className="flex-1"
                  />
                )}
                <Badge variant={isConnected ? "default" : "secondary"}>
                  {isConnected ? 'Connected' : 'Connecting...'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <MessageThread
                conversationId={state.selectedConversationId}
                userId={session.user.id}
                onMessageEditAction={handleMessageEdit}
                onMessageDeleteAction={handleMessageDelete}
                onMessageReactionAction={handleMessageReaction}
                className="h-full"
              />
            </CardContent>
          </motion.div>
        ) : (
          <motion.div
            key="no-conversation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full flex items-center justify-center"
          >
            <div className="text-center">
              <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {t('selectConversation') || 'Select a conversation to start messaging'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )

  const renderDesktopLayout = () => (
    <Card className={cn("w-full max-w-6xl mx-auto", className)}>
      <div className="flex h-[700px]">
        {/* Conversation List Sidebar */}
        {showConversationList && (
          <div className="w-80 border-r">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                {t('messages') || 'Messages'}
              </CardTitle>
            </CardHeader>
            <div className="h-[calc(100%-80px)]">
              <ConversationList
                userId={session.user.id}
                onConversationSelectAction={handleConversationSelect}
                selectedConversationId={state.selectedConversationId}
                onNewConversationAction={handleNewConversation}
              />
            </div>
          </div>
        )}

        {/* Message Thread Area */}
        <div className="flex-1 flex flex-col">
          {state.selectedConversationId ? (
            <>
              {/* Conversation Header */}
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  {selectedConversation && (
                    <ConversationHeader
                      conversation={selectedConversation}
                      currentUserId={session.user.id}
                      className="flex-1"
                    />
                  )}
                  <Badge variant={isConnected ? "default" : "secondary"}>
                    {isConnected ? 'Connected' : 'Connecting...'}
                  </Badge>
                </div>
              </CardHeader>

              {/* Messages */}
              <div className="flex-1 overflow-hidden">
                <MessageThread
                  conversationId={state.selectedConversationId}
                  userId={session.user.id}
                  onMessageEditAction={handleMessageEdit}
                  onMessageDeleteAction={handleMessageDelete}
                  onMessageReactionAction={handleMessageReaction}
                  className="h-full"
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg text-muted-foreground mb-2">
                  {t('selectConversation') || 'Select a conversation to start messaging'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('conversationHint') || 'Choose from your conversations or start a new one'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Connection Status Alert */}
      {!isConnected && (
        <Alert className="m-4">
          <AlertDescription className="text-sm">
            {t('reconnecting') || 'Reconnecting to chat server...'}
          </AlertDescription>
        </Alert>
      )}
    </Card>
  )

  return isMobile ? renderMobileLayout() : renderDesktopLayout()
}

export default function Chat(props: ChatProps) {
  return <ChatContent {...props} />
} 