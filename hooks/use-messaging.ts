import { useState, useEffect, useCallback, useMemo, use } from 'react'
import { useSession } from 'next-auth/react'
import { apiClient, ApiClientError, type ApiResponse } from '@/lib/api-client'
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

      // Use API client with optimized timeout for conversation fetching
      const response: ApiResponse<{ data: Conversation[], pagination?: { hasMore: boolean } }> = await apiClient.get(
        `${API_BASE}/conversations?${params}`,
        {
          timeout: 8000, // 8 second timeout for conversation listing
          retries: 1 // Retry once for conversation loading
        }
      )

      if (response.success && response.data) {
        const data = response.data;

        if (reset) {
          setConversations(data.data)
        } else {
          setConversations(prev => [...prev, ...data.data])
        }
        
        setHasMore(data.pagination?.hasMore || false)
      } else {
        throw new Error(response.error || 'Failed to fetch conversations')
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        console.error('Conversations fetch failed:', {
          endpoint: '/conversations',
          statusCode: err.statusCode,
          context: err.context
        });
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred')
        console.error('Unexpected error fetching conversations:', err)
      }
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
      // Use API client with optimized timeout for conversation creation
      const response: ApiResponse<{ data: Conversation }> = await apiClient.post(
        `${API_BASE}/conversations`, 
        data,
        {
          timeout: 12000, // 12 second timeout for conversation creation
          retries: 2 // Retry twice for conversation creation (important for UX)
        }
      )

      if (response.success && response.data) {
        // Add the new conversation to the beginning of the list
        setConversations(prev => [response.data.data, ...prev])
        return response.data.data
      } else {
        throw new Error(response.error || 'Failed to create conversation')
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        const errorMessage = err.message || 'Failed to create conversation';
        setError(errorMessage);
        console.error('Conversation creation failed:', {
          endpoint: '/conversations',
          statusCode: err.statusCode,
          context: err.context
        });
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create conversation')
        console.error('Unexpected error creating conversation:', err)
      }
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

        // Use API client with messaging domain configuration (10s timeout, 2 retries)
        const response: ApiResponse<{ data: Conversation }> = await apiClient.get(`${API_BASE}/conversations/${conversationId}`, {
          timeout: 10000, // 10 second timeout for conversation fetching
          retries: 2 // Retry twice for messaging operations
        })

        if (response.success && response.data) {
          setConversation(response.data.data)
        } else {
          throw new Error(response.error || 'Failed to fetch conversation')
        }
      } catch (err) {
        if (err instanceof ApiClientError) {
          setError(err.message)
          console.error('Conversation fetch failed:', {
            endpoint: `/conversations/${conversationId}`,
            statusCode: err.statusCode,
            conversationId,
            context: err.context
          })
        } else {
          setError(err instanceof Error ? err.message : 'An error occurred')
          console.error('Unexpected error fetching conversation:', err)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchConversation()
  }, [session?.user?.id, conversationId])

  const markAsRead = useCallback(async () => {
    if (!conversationId) return

    try {
      // Use API client with messaging domain configuration (10s timeout, 2 retries)
      const response: ApiResponse = await apiClient.put(`${API_BASE}/conversations/${conversationId}`, 
        { action: 'mark_read' }, 
        {
          timeout: 8000, // 8 second timeout for quick actions
          retries: 1 // Retry once for mark read operations
        }
      )

      if (!response.success) {
        throw new Error(response.error || 'Failed to mark as read')
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        console.error('Mark conversation as read failed:', {
          endpoint: `/conversations/${conversationId}`,
          statusCode: err.statusCode,
          conversationId,
          context: err.context
        })
      } else {
        console.error('Unexpected error marking conversation as read:', err)
      }
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

      // Use API client with optimized timeout for chat operations
      const response: ApiResponse<{ data: Message[], pagination?: { hasMore: boolean } }> = await apiClient.get(
        `${API_BASE}/conversations/${conversationId}/messages?${params}`, 
        {
          timeout: 8000, // 8 second timeout for chat message fetching
          retries: 1 // Retry once for message loading
        }
      )

      if (response.success && response.data) {
        const data = response.data;

        if (reset) {
          setMessages(data.data)
        } else {
          setMessages(prev => [...data.data, ...prev])
        }
        
        setHasMore(data.pagination?.hasMore || false)
      } else {
        throw new Error(response.error || 'Failed to fetch messages')
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        console.error('Messages fetch failed:', {
          endpoint: `/conversations/${conversationId}/messages`,
          statusCode: err.statusCode,
          conversationId,
          context: err.context
        });
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred')
        console.error('Unexpected error fetching messages:', err)
      }
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

      // Use API client with optimized timeout for message sending
      const response: ApiResponse<{ data: Message }> = await apiClient.post(
        `${API_BASE}/conversations/${conversationId}/messages`, 
        messageData,
        {
          timeout: 10000, // 10 second timeout for message sending (includes processing)
          retries: 2 // Retry twice for message sending (important for UX)
        }
      )

      if (response.success && response.data) {
        // Add the new message to the end of the list
        setMessages(prev => [...prev, response.data.data])
        return response.data.data
      } else {
        throw new Error(response.error || 'Failed to send message')
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        const errorMessage = err.message || 'Failed to send message';
        setError(errorMessage);
        console.error('Message send failed:', {
          endpoint: `/conversations/${conversationId}/messages`,
          statusCode: err.statusCode,
          conversationId,
          messageType: options?.type || 'text',
          context: err.context
        });
      } else {
        setError(err instanceof Error ? err.message : 'Failed to send message')
        console.error('Unexpected error sending message:', err)
      }
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

/**
 * Internal function to fetch conversations
 * Enhanced with timeout, retry, and standardized error handling
 */
async function fetchConversationsData(filters?: ConversationFilters, pagination?: PaginationOptions): Promise<{ data: Conversation[], pagination?: { hasMore: boolean } }> {
  const params = new URLSearchParams()
  if (filters?.type) params.set('type', filters.type)
  if (filters?.isActive !== undefined) params.set('isActive', filters.isActive.toString())
  if (pagination?.limit) params.set('limit', pagination.limit.toString())
  if (pagination?.cursor) params.set('cursor', pagination.cursor)

  // Use API client with optimized timeout for conversation fetching
  const response: ApiResponse<{ data: Conversation[], pagination?: { hasMore: boolean } }> = await apiClient.get(
    `${API_BASE}/conversations?${params}`,
    {
      timeout: 8000, // 8 second timeout for conversation listing
      retries: 1 // Retry once for conversation loading
    }
  )

  if (response.success && response.data) {
    return response.data
  } else {
    throw new Error(response.error || 'Failed to fetch conversations')
  }
}

/**
 * React 19 Promise-based hook for conversations using use() function
 * Returns a promise that can be consumed with React 19's use() function
 * 
 * Usage:
 * ```tsx
 * function ConversationsList() {
 *   const conversationsPromise = useConversationsPromise({ limit: 10 })
 *   const conversationsData = use(conversationsPromise)
 *   
 *   return (
 *     <div>
 *       {conversationsData.data.map(conv => (
 *         <div key={conv.id}>{conv.title}</div>
 *       ))}
 *     </div>
 *   )
 * }
 * 
 * // Wrap in Suspense boundary
 * function App() {
 *   return (
 *     <Suspense fallback={<div>Loading conversations...</div>}>
 *       <ConversationsList />
 *     </Suspense>
 *   )
 * }
 * ```
 */
export function useConversationsPromise(filters?: ConversationFilters, pagination?: PaginationOptions): Promise<{ data: Conversation[], pagination?: { hasMore: boolean } }> {
  return useMemo(() => {
    return fetchConversationsData(filters, pagination)
  }, [filters, pagination])
}

/**
 * React 19 Enhanced hook that directly uses use() function for conversations
 * Suspends the component until the conversations are loaded
 */
export function useConversationsWithSuspense(filters?: ConversationFilters, pagination?: PaginationOptions): { data: Conversation[], pagination?: { hasMore: boolean } } {
  const promise = useConversationsPromise(filters, pagination)
  return use(promise)
} 