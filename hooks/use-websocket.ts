import { useEffect, useRef, useState, useCallback } from 'react'
import { useSession } from '@/components/providers/session-provider'
import { wsClient, WebSocketEvents } from '@/lib/websocket-client'
import { Message, TypingIndicator } from '@/features/chat/types'

export function useWebSocket() {
  const { data: session } = useSession()
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connect = useCallback(async () => {
    if (!session?.accessToken || isConnected || isConnecting) return

    try {
      setIsConnecting(true)
      setError(null)
      await wsClient.connect(session.accessToken)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Connection failed'
      setError(errorMessage)
    } finally {
      setIsConnecting(false)
    }
  }, [session?.accessToken, isConnected, isConnecting])

  const disconnect = useCallback(() => {
    wsClient.disconnect()
    setIsConnected(false)
    setIsConnecting(false)
    setError(null)
  }, [])

  useEffect(() => {
    if (session?.accessToken) {
      connect()
    } else {
      disconnect()
    }

    // Event handlers
    const handleConnected = () => {
      setIsConnected(true)
      setIsConnecting(false)
      setError(null)
    }

    const handleDisconnected = () => {
      setIsConnected(false)
      setIsConnecting(false)
    }

    const handleError = (error: any) => {
      setError(error.message || 'Connection error')
      setIsConnected(false)
      setIsConnecting(false)
    }

    wsClient.on('connected', handleConnected)
    wsClient.on('disconnected', handleDisconnected)
    wsClient.on('connection_error', handleError)

    return () => {
      wsClient.off('connected', handleConnected)
      wsClient.off('disconnected', handleDisconnected)
      wsClient.off('connection_error', handleError)
    }
  }, [session?.accessToken, connect, disconnect])

  return { 
    isConnected, 
    isConnecting, 
    error, 
    wsClient, 
    connect, 
    disconnect 
  }
}

export function useRealTimeMessages(conversationId: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const { wsClient, isConnected } = useWebSocket()
  const previousConversationId = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!conversationId || !isConnected) return

    // Handle conversation change
    if (previousConversationId.current && previousConversationId.current !== conversationId) {
      wsClient.leaveConversation(previousConversationId.current)
    }

    // Join new conversation
    wsClient.joinConversation(conversationId)
    previousConversationId.current = conversationId

    // Message event handlers
    const handleMessageReceived = (message: Message) => {
      if (message.conversationId === conversationId) {
        setMessages(prev => {
          // Avoid duplicates
          const exists = prev.some(m => m.id === message.id)
          if (exists) return prev
                     return [...prev, message].sort((a, b) => {
             const getTimestamp = (timestamp: any): number => {
               if (!timestamp) return Date.now()
               if (typeof timestamp === 'number') return timestamp
               if (timestamp.toMillis && typeof timestamp.toMillis === 'function') {
                 return timestamp.toMillis()
               }
               if (timestamp.seconds) return timestamp.seconds * 1000
               return Date.now()
             }
             return getTimestamp(a.timestamp) - getTimestamp(b.timestamp)
           })
        })
      }
    }

    const handleMessageUpdated = (updatedMessage: Message) => {
      if (updatedMessage.conversationId === conversationId) {
        setMessages(prev => prev.map(msg => 
          msg.id === updatedMessage.id ? updatedMessage : msg
        ))
      }
    }

    const handleMessageDeleted = (messageId: string) => {
      setMessages(prev => prev.filter(msg => msg.id !== messageId))
    }

    wsClient.on('message_received', handleMessageReceived)
    wsClient.on('message_updated', handleMessageUpdated)
    wsClient.on('message_deleted', handleMessageDeleted)

    return () => {
      if (conversationId) {
        wsClient.leaveConversation(conversationId)
      }
      wsClient.off('message_received', handleMessageReceived)
      wsClient.off('message_updated', handleMessageUpdated)
      wsClient.off('message_deleted', handleMessageDeleted)
    }
  }, [conversationId, isConnected, wsClient])

  const sendMessage = useCallback((content: string, type: 'text' | 'image' | 'file' = 'text') => {
    if (!conversationId || !isConnected) return

    const messageData = {
      conversationId,
      senderId: '', // Will be set by server based on auth
      senderName: '', // Will be set by server based on auth
      content,
      type
    }

    wsClient.sendMessage(messageData)
  }, [conversationId, isConnected, wsClient])

  return { 
    messages, 
    setMessages, 
    sendMessage,
    isConnected 
  }
}

export function useTypingIndicators(conversationId: string) {
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const { wsClient, isConnected } = useWebSocket()
  const typingTimeout = useRef<NodeJS.Timeout | null>(null)
  const isTypingRef = useRef(false)

  useEffect(() => {
    if (!conversationId || !isConnected) return

    const handleUserTyping = ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
      setTypingUsers(prev => {
        const next = new Set(prev)
        if (isTyping) {
          next.add(userId)
        } else {
          next.delete(userId)
        }
        return next
      })

      // Auto-remove typing indicator after 3 seconds
      if (isTyping) {
        if (typingTimeout.current) clearTimeout(typingTimeout.current)
        typingTimeout.current = setTimeout(() => {
          setTypingUsers(prev => {
            const next = new Set(prev)
            next.delete(userId)
            return next
          })
        }, 3000)
      }
    }

    wsClient.on('user_typing', handleUserTyping)

    return () => {
      wsClient.off('user_typing', handleUserTyping)
      clearTimeout(typingTimeout.current)
    }
  }, [conversationId, isConnected, wsClient])

  const stopTyping = useCallback(() => {
    if (!conversationId || !isConnected || !isTypingRef.current) return
    
    isTypingRef.current = false
    wsClient.stopTyping(conversationId)
    clearTimeout(typingTimeout.current)
  }, [conversationId, isConnected, wsClient])

  const startTyping = useCallback(() => {
    if (!conversationId || !isConnected || isTypingRef.current) return
    
    isTypingRef.current = true
    wsClient.startTyping(conversationId)
    
    // Auto-stop typing after 3 seconds of inactivity
    clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => {
      if (isTypingRef.current) {
        stopTyping()
      }
    }, 3000)
  }, [conversationId, isConnected, wsClient, stopTyping])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isTypingRef.current) {
        stopTyping()
      }
    }
  }, [stopTyping])

  return { 
    typingUsers: Array.from(typingUsers), 
    startTyping, 
    stopTyping,
    isConnected 
  }
}

export function usePresence() {
  const [onlineUsers, setOnlineUsers] = useState<Map<string, Date>>(new Map())
  const { wsClient, isConnected } = useWebSocket()

  useEffect(() => {
    if (!isConnected) return

    const handlePresenceUpdate = ({ userId, isOnline, lastSeen }: {
      userId: string
      isOnline: boolean
      lastSeen: Date
    }) => {
      setOnlineUsers(prev => {
        const next = new Map(prev)
        if (isOnline) {
          next.set(userId, new Date())
        } else {
          next.set(userId, new Date(lastSeen))
        }
        return next
      })
    }

    wsClient.on('presence_update', handlePresenceUpdate)

    return () => {
      wsClient.off('presence_update', handlePresenceUpdate)
    }
  }, [isConnected, wsClient])

  const isUserOnline = useCallback((userId: string): boolean => {
    const lastSeen = onlineUsers.get(userId)
    if (!lastSeen) return false
    
    // Consider user online if last seen within 30 seconds
    return Date.now() - lastSeen.getTime() < 30000
  }, [onlineUsers])

  const getUserLastSeen = useCallback((userId: string): Date | null => {
    return onlineUsers.get(userId) || null
  }, [onlineUsers])

  return { 
    onlineUsers, 
    isUserOnline, 
    getUserLastSeen,
    isConnected 
  }
}

export function useMessageStatus(conversationId: string) {
  const { wsClient, isConnected } = useWebSocket()

  const markAsRead = useCallback((messageIds: string[]) => {
    if (!conversationId || !isConnected || messageIds.length === 0) return
    
    wsClient.markAsRead(conversationId, messageIds)
  }, [conversationId, isConnected, wsClient])

  const markAllAsRead = useCallback((messages: Message[]) => {
    const unreadIds = messages
      .filter(msg => msg.status !== 'read')
      .map(msg => msg.id)
    
    if (unreadIds.length > 0) {
      markAsRead(unreadIds)
    }
  }, [markAsRead])

  return {
    markAsRead,
    markAllAsRead,
    isConnected
  }
} 