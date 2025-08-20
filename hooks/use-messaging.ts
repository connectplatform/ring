import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from '@/components/providers/session-provider'
import { 
  Conversation, 
  Message, 
  ConversationFilters, 
  PaginationOptions,
  CreateConversationRequest,
  SendMessageRequest,
  TypingIndicator
} from '@/features/chat/types'

// API base URL
const API_BASE = '/api'

export function useConversations(filters?: ConversationFilters, pagination?: PaginationOptions) {
  const { data: session } = useSession()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  const fetchConversations = useCallback(async (reset = false) => {
    if (!session?.user?.id) return

    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (filters?.type) params.set('type', filters.type)
      if (filters?.isActive !== undefined) params.set('isActive', filters.isActive.toString())
      if (pagination?.limit) params.set('limit', pagination.limit.toString())
      if (pagination?.cursor && !reset) params.set('cursor', pagination.cursor)

      const response = await fetch(`${API_BASE}/conversations?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch conversations')
      }

      if (reset) {
        setConversations(data.data)
      } else {
        setConversations(prev => [...prev, ...data.data])
      }
      
      setHasMore(data.pagination?.hasMore || false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id, filters, pagination])

  useEffect(() => {
    fetchConversations(true)
  }, [fetchConversations])

  const createConversation = useCallback(async (data: CreateConversationRequest): Promise<Conversation | null> => {
    if (!session?.user?.id) return null

    try {
      const response = await fetch(`${API_BASE}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create conversation')
      }

      // Add the new conversation to the beginning of the list
      setConversations(prev => [result.data, ...prev])
      return result.data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create conversation')
      return null
    }
  }, [session?.user?.id])

  const loadMore = useCallback(() => {
    if (hasMore && !loading && conversations.length > 0) {
      const lastConversation = conversations[conversations.length - 1]
      fetchConversations(false)
    }
  }, [hasMore, loading, conversations, fetchConversations])

  return {
    conversations,
    loading,
    error,
    hasMore,
    createConversation,
    loadMore,
    refresh: () => fetchConversations(true)
  }
}

export function useConversation(conversationId: string) {
  const { data: session } = useSession()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.user?.id || !conversationId) return

    const fetchConversation = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`${API_BASE}/conversations/${conversationId}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch conversation')
        }

        setConversation(data.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchConversation()
  }, [session?.user?.id, conversationId])

  const markAsRead = useCallback(async () => {
    if (!conversationId) return

    try {
      const response = await fetch(`${API_BASE}/conversations/${conversationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read' })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to mark as read')
      }
    } catch (err) {
      console.error('Error marking conversation as read:', err)
    }
  }, [conversationId])

  return {
    conversation,
    loading,
    error,
    markAsRead
  }
}

export function useMessages(conversationId: string, pagination?: PaginationOptions) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  const fetchMessages = useCallback(async (reset = false) => {
    if (!session?.user?.id || !conversationId) return

    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (pagination?.limit) params.set('limit', pagination.limit.toString())
      if (pagination?.cursor && !reset) params.set('cursor', pagination.cursor)
      if (pagination?.direction) params.set('direction', pagination.direction)

      const response = await fetch(`${API_BASE}/conversations/${conversationId}/messages?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch messages')
      }

      if (reset) {
        setMessages(data.data)
      } else {
        setMessages(prev => [...data.data, ...prev])
      }
      
      setHasMore(data.pagination?.hasMore || false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id, conversationId, pagination])

  useEffect(() => {
    fetchMessages(true)
  }, [fetchMessages])

  const sendMessage = useCallback(async (content: string, options?: Partial<SendMessageRequest>): Promise<Message | null> => {
    if (!session?.user?.id || !conversationId) return null

    try {
      const messageData = {
        content,
        type: options?.type || 'text',
        replyTo: options?.replyTo,
        attachments: options?.attachments
      }

      const response = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData)
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to send message')
      }

      // Add the new message to the end of the list
      setMessages(prev => [...prev, result.data])
      return result.data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
      return null
    }
  }, [session?.user?.id, conversationId])

  const loadMore = useCallback(() => {
    if (hasMore && !loading && messages.length > 0) {
      fetchMessages(false)
    }
  }, [hasMore, loading, messages, fetchMessages])

  return {
    messages,
    loading,
    error,
    hasMore,
    sendMessage,
    loadMore,
    refresh: () => fetchMessages(true)
  }
}

export function useTyping(conversationId: string) {
  const { data: session } = useSession()
  const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([])
  const [isTyping, setIsTyping] = useState(false)

  // Mock implementation for typing indicators
  // In a real implementation, this would connect to WebSocket or Firebase Realtime Database
  const updateTypingStatus = useCallback(async (typing: boolean) => {
    if (!session?.user?.id || !conversationId) return

    setIsTyping(typing)
    
    // Here you would make an API call to update typing status
    // For now, we'll just simulate the behavior
    console.log(`User ${session.user.id} is ${typing ? 'typing' : 'not typing'} in conversation ${conversationId}`)
  }, [session?.user?.id, conversationId])

  const startTyping = useCallback(() => updateTypingStatus(true), [updateTypingStatus])
  const stopTyping = useCallback(() => updateTypingStatus(false), [updateTypingStatus])

  return {
    typingUsers,
    isTyping,
    startTyping,
    stopTyping
  }
} 