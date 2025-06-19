'use client'

import React, { useEffect, useState } from 'react'
import { useActionState, useOptimistic } from 'react'
import { useFormStatus } from 'react-dom'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, MessageCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useTranslation } from '@/node_modules/react-i18next'
import { sendMessage, MessageFormState } from '@/app/actions/chat'
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase-client'

interface Message {
  id: string
  senderId: string
  content: string
  timestamp: Timestamp
  pending?: boolean
}

interface ChatProps {
  entityId: string
  entityName: string
  entityCreatorId: string
  opportunityId?: string
  opportunityName?: string
  className?: string
}

function SendButton() {
  const { pending } = useFormStatus()
  const { t } = useTranslation()
  
  return (
    <Button 
      type="submit" 
      size="sm"
      disabled={pending}
      className="px-3"
    >
      {pending ? (
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="h-4 w-4 border-2 border-white border-t-transparent rounded-full"
        />
      ) : (
        <Send className="h-4 w-4" />
      )}
    </Button>
  )
}

function ChatContent({ entityId, entityName, entityCreatorId, opportunityId, opportunityName }: ChatProps) {
  const { t } = useTranslation()
  const { data: session, status } = useSession()
  const [realMessages, setRealMessages] = useState<Message[]>([])
  const [state, formAction] = useActionState<MessageFormState | null, FormData>(
    sendMessage,
    null
  )

  // Optimistic updates for instant message display
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    realMessages,
    (currentMessages: Message[], newMessage: Message) => [...currentMessages, newMessage]
  )

  const chatId = opportunityId || entityId
  const chatName = opportunityName ? `${entityName} - ${opportunityName}` : entityName

  // Real-time message listener
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return

    const chatQuery = query(
      collection(db, 'chats'),
      where('chatId', '==', chatId),
      where('participants', 'array-contains', session.user.id),
      orderBy('timestamp', 'asc')
    )

    const unsubscribe = onSnapshot(chatQuery, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[]
      setRealMessages(newMessages)
    })

    return () => unsubscribe()
  }, [status, session, chatId])

  // Enhanced form action with optimistic updates
  const handleSubmit = async (formData: FormData) => {
    if (!session?.user?.id) return

    const messageContent = formData.get('message') as string
    if (!messageContent.trim()) return

    // Optimistic update - show message immediately
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      senderId: session.user.id,
      content: messageContent,
      timestamp: Timestamp.now(),
      pending: true
    }

    addOptimisticMessage(optimisticMessage)

    // Clear the form immediately
    const form = document.querySelector('form') as HTMLFormElement
    if (form) form.reset()

    // Send to server
    await formAction(formData)
  }

  if (status === 'loading') {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="text-center">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="mx-auto h-8 w-8 border-2 border-primary border-t-transparent rounded-full"
            />
            <p className="mt-2 text-muted-foreground">{t('loadingChat') || 'Loading chat...'}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <Alert>
        <MessageCircle className="h-4 w-4" />
        <AlertDescription>
          {t('signInToChat') || 'Please sign in to access the chat.'}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          {t('chatWith') || 'Chat with'} {chatName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Messages */}
        <ScrollArea className="h-64 w-full rounded-md border p-4">
          <AnimatePresence>
            {optimisticMessages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className={`mb-3 flex ${
                  message.senderId === session?.user?.id ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-xs rounded-lg px-3 py-2 ${
                    message.senderId === session?.user?.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  {message.pending && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {t('sending') || 'Sending...'}
                    </Badge>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </ScrollArea>

        {/* Error display */}
        {state?.error && (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        {/* Message input */}
        <form action={handleSubmit} className="flex space-x-2">
          <input type="hidden" name="chatId" value={chatId} />
          <input type="hidden" name="entityId" value={entityId} />
          <input type="hidden" name="entityName" value={entityName} />
          <input type="hidden" name="entityCreatorId" value={entityCreatorId} />
          {opportunityId && (
            <input type="hidden" name="opportunityId" value={opportunityId} />
          )}
          {opportunityName && (
            <input type="hidden" name="opportunityName" value={opportunityName} />
          )}
          
          <Input
            name="message"
            placeholder={t('typeMessage') || 'Type a message...'}
            className="flex-1"
            autoComplete="off"
          />
          <SendButton />
        </form>
      </CardContent>
    </Card>
  )
}

export function Chat(props: ChatProps) {
  return (
    <div className={props.className}>
      <ChatContent {...props} />
    </div>
  )
} 