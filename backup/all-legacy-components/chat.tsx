'use client'

import React, { useState, useEffect } from 'react'
import { useSession, SessionProvider } from 'next-auth/react'
import { db } from '@/lib/firebase-client'
import { collection, query, where, orderBy, addDoc, onSnapshot, Timestamp } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useTranslation } from '@/node_modules/react-i18next'

interface chatProps {
  entityId: string;
  entityName: string;
  entityCreatorId: string;
  opportunityId?: string;
  opportunityName?: string;
}

interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: Timestamp;
}

export const Chat: React.FC<chatProps> = ({ 
  entityId, 
  entityName, 
  entityCreatorId, 
  opportunityId, 
  opportunityName 
}) => {
  const { t } = useTranslation()
  const { data: session, status } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const chatId = opportunityId || entityId
  const chatName = opportunityName ? `${entityName} - ${opportunityName}` : entityName

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return

    const chatQuery = query(
      collection(db, 'chats'),
      where('chatId', '==', chatId),
      where('participants', 'array-contains', session.user.id),
      orderBy('timestamp', 'asc')
    )
    // Set up real-time listener for chat messages
    // This query fetches messages for the current chat where the user is a participant
    // Messages are ordered by timestamp to maintain chronological order
    const unsubscribe = onSnapshot(chatQuery, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[]
      setMessages(newMessages)
    })

    return () => unsubscribe()
  }, [status, session, chatId])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (status !== 'authenticated' || !session?.user?.id || !newMessage.trim()) return

    try {
      await addDoc(collection(db, 'chats'), {
        chatId,
        participants: [session.user.id, entityCreatorId],
        senderId: session.user.id,
        content: newMessage,
        timestamp: Timestamp.now(),
        entityId,
        entityName,
        opportunityId,
        opportunityName
      })
      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  if (status === 'loading' || loading) {
    return <div>{t('loading')}</div>
  }

  if (status === 'unauthenticated') {
    return <div>Please sign in to access the chat.</div>
  }

  return (
    <div className="bg-card text-card-foreground rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">chat with {chatName}</h2>
      <ScrollArea className="h-64 mb-4">
        {messages.map((message) => (
          <div key={message.id} className={`mb-2 ${message.senderId === session?.user?.id ? 'text-right' : 'text-left'}`}>
            <span className="inline-block bg-primary text-primary-foreground rounded px-2 py-1">
              {message.content}
            </span>
          </div>
        ))}
      </ScrollArea>
      <form onSubmit={sendMessage} className="flex">
        <Input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-grow mr-2"
        />
        <Button type="submit">Send</Button>
      </form>
    </div>
  )
}

export default Chat

