'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useTunnel } from '@/hooks/use-tunnel'
import { apiClient, ApiClientError, type ApiResponse } from '@/lib/api-client'
import { normalizeMessagePayload } from '@/features/chat/lib/normalize-message'
import type { TunnelMessage } from '@/lib/tunnel/types'
import {
  Conversation,
  Message,
  ConversationFilters,
  PaginationOptions,
  CreateConversationRequest,
  SendMessageRequest,
  TypingIndicator,
} from '@/features/chat/types'

const API_BASE = '/api'

function stableFiltersKey(filters?: ConversationFilters): string {
  if (!filters) return ''
  return JSON.stringify({
    type: filters.type ?? null,
    isActive: filters.isActive ?? null,
    entityId: filters.entityId ?? null,
    opportunityId: filters.opportunityId ?? null,
    productId: filters.productId ?? null,
  })
}

function mergeUniqueById<T extends { id: string }>(prev: T[], next: T[]): T[] {
  if (next.length === 0) return prev
  const ids = new Set(prev.map((item) => item.id))
  const appended = next.filter((item) => !ids.has(item.id))
  return appended.length === 0 ? prev : [...prev, ...appended]
}

export type UseConversationsResult = {
  conversations: Conversation[]
  loading: boolean
  error: string | null
  hasMore: boolean
  createConversation: (data: CreateConversationRequest) => Promise<Conversation | null>
  loadMore: () => void
  refresh: () => Promise<void>
}

export function useConversations(
  filters?: ConversationFilters,
  pagination?: PaginationOptions,
): UseConversationsResult {
  const { data: session } = useSession()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  const cursorRef = useRef<string | null>(null)
  const filtersKey = stableFiltersKey(filters)
  const limit = pagination?.limit ?? 20

  const fetchConversations = useCallback(
    async (reset = false) => {
      if (!session?.user?.id) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        if (reset) {
          cursorRef.current = null
        }

        const params = new URLSearchParams()
        params.set('limit', String(limit))
        if (filters?.type) params.set('type', filters.type)
        if (filters?.isActive !== undefined) params.set('isActive', filters.isActive.toString())
        if (filters?.entityId) params.set('entityId', filters.entityId)
        if (filters?.opportunityId) params.set('opportunityId', filters.opportunityId)
        if (filters?.productId) params.set('productId', filters.productId)
        if (!reset && cursorRef.current) params.set('cursor', cursorRef.current)

        const response: ApiResponse<Conversation[]> = await apiClient.get(
          `${API_BASE}/conversations?${params}`,
          {
            timeout: 8000,
            retries: 1,
          },
        )

        if (response.success) {
          const list = Array.isArray(response.data) ? response.data : []

          if (reset) {
            setConversations(list)
          } else {
            setConversations((prev) => mergeUniqueById(prev, list))
          }

          setHasMore(response.pagination?.hasMore ?? false)
          if (response.pagination?.cursor) {
            cursorRef.current = response.pagination.cursor
          } else if (list.length > 0) {
            cursorRef.current = list[list.length - 1].id
          }
        } else {
          throw new Error(response.error || 'Failed to fetch conversations')
        }
      } catch (err) {
        if (err instanceof ApiClientError) {
          setError(err.message)
          console.error('Conversations fetch failed:', {
            endpoint: '/conversations',
            statusCode: err.statusCode,
            context: err.context,
          })
        } else {
          setError(err instanceof Error ? err.message : 'An error occurred')
          console.error('Unexpected error fetching conversations:', err)
        }
      } finally {
        setLoading(false)
      }
    },
    [session?.user?.id, filtersKey, limit],
  )

  useEffect(() => {
    void fetchConversations(true)
  }, [fetchConversations])

  const createConversation = useCallback(
    async (data: CreateConversationRequest): Promise<Conversation | null> => {
      if (!session?.user?.id) return null

      try {
        const response: ApiResponse<Conversation> = await apiClient.post(
          `${API_BASE}/conversations`,
          data,
          {
            timeout: 12000,
            retries: 2,
          },
        )

        if (response.success && response.data) {
          setConversations((prev) => [response.data!, ...prev])
          return response.data
        }

        throw new Error(response.error || 'Failed to create conversation')
      } catch (err) {
        if (err instanceof ApiClientError) {
          const errorMessage = err.message || 'Failed to create conversation'
          setError(errorMessage)
          console.error('Conversation creation failed:', {
            endpoint: '/conversations',
            statusCode: err.statusCode,
            context: err.context,
          })
        } else {
          setError(err instanceof Error ? err.message : 'Failed to create conversation')
          console.error('Unexpected error creating conversation:', err)
        }
        return null
      }
    },
    [session?.user?.id],
  )

  const loadMore = useCallback(() => {
    if (hasMore && !loading && cursorRef.current) {
      void fetchConversations(false)
    }
  }, [hasMore, loading, fetchConversations])

  const refresh = useCallback(() => fetchConversations(true), [fetchConversations])

  return {
    conversations,
    loading,
    error,
    hasMore,
    createConversation,
    loadMore,
    refresh,
  }
}

export function useConversation(conversationId: string, options?: { enabled?: boolean }) {
  const { data: session } = useSession()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const enabled = options?.enabled !== false

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    if (!session?.user?.id || !conversationId) return

    const fetchConversation = async () => {
      try {
        setLoading(true)
        setError(null)

        const response: ApiResponse<Conversation> = await apiClient.get(
          `${API_BASE}/conversations/${conversationId}`,
          {
            timeout: 10000,
            retries: 2,
          },
        )

        if (response.success && response.data) {
          setConversation(response.data)
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
            context: err.context,
          })
        } else {
          setError(err instanceof Error ? err.message : 'An error occurred')
          console.error('Unexpected error fetching conversation:', err)
        }
      } finally {
        setLoading(false)
      }
    }

    void fetchConversation()
  }, [session?.user?.id, conversationId, enabled])

  const markAsRead = useCallback(async () => {
    if (!conversationId) return

    try {
      const response: ApiResponse = await apiClient.put(
        `${API_BASE}/conversations/${conversationId}`,
        { action: 'mark_read' },
        {
          timeout: 8000,
          retries: 1,
        },
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
          context: err.context,
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
    markAsRead,
  }
}

export function useMessages(conversationId: string, pagination?: PaginationOptions) {
  const { data: session } = useSession()
  const { subscribe, isConnected } = useTunnel()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  const cursorRef = useRef<string | null>(null)
  const limit = pagination?.limit ?? 50
  const direction = pagination?.direction

  useEffect(() => {
    cursorRef.current = null
  }, [conversationId])

  const fetchMessages = useCallback(
    async (reset = false) => {
      if (!session?.user?.id || !conversationId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        if (reset) {
          cursorRef.current = null
        }

        const params = new URLSearchParams()
        params.set('limit', String(limit))
        if (direction) params.set('direction', direction)
        if (!reset && cursorRef.current) params.set('cursor', cursorRef.current)

        const response: ApiResponse<Message[]> = await apiClient.get(
          `${API_BASE}/conversations/${conversationId}/messages?${params}`,
          {
            timeout: 8000,
            retries: 1,
          },
        )

        if (response.success) {
          const list = Array.isArray(response.data) ? response.data : []

          if (reset) {
            setMessages(list)
          } else {
            setMessages((prev) => mergeUniqueById(list, prev))
          }

          setHasMore(response.pagination?.hasMore ?? false)
          if (response.pagination?.cursor) {
            cursorRef.current = response.pagination.cursor
          } else if (list.length > 0) {
            cursorRef.current = list[list.length - 1].id
          }
        } else {
          throw new Error(response.error || 'Failed to fetch messages')
        }
      } catch (err) {
        if (err instanceof ApiClientError) {
          setError(err.message)
          console.error('Messages fetch failed:', {
            endpoint: `/conversations/${conversationId}/messages`,
            statusCode: err.statusCode,
            conversationId,
            context: err.context,
          })
        } else {
          setError(err instanceof Error ? err.message : 'An error occurred')
          console.error('Unexpected error fetching messages:', err)
        }
      } finally {
        setLoading(false)
      }
    },
    [session?.user?.id, conversationId, limit, direction],
  )

  useEffect(() => {
    void fetchMessages(true)
  }, [fetchMessages])

  useEffect(() => {
    if (!session?.user?.id || !conversationId) return
    const channel = `conversation:${conversationId}`

    const onTunnelMessage = (msg: TunnelMessage) => {
      const event = msg.event
      if (event === 'message:new' && msg.payload) {
        const incoming = normalizeMessagePayload(msg.payload, conversationId)
        if (!incoming) return
        setMessages((prev) => {
          if (prev.some((p) => p.id === incoming.id)) return prev
          return [...prev, incoming]
        })
        return
      }
      if (event === 'message:deleted' && msg.payload && typeof msg.payload === 'object') {
        const id = (msg.payload as { id?: string }).id
        if (!id) return
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, content: '[Message deleted]' } : m)),
        )
        return
      }
      if (event === 'message:update' && msg.payload) {
        const incoming = normalizeMessagePayload(msg.payload, conversationId)
        if (!incoming) return
        setMessages((prev) => {
          const idx = prev.findIndex((p) => p.id === incoming.id)
          if (idx === -1) return [...prev, incoming]
          const next = [...prev]
          next[idx] = { ...next[idx], ...incoming }
          return next
        })
      }
    }

    return subscribe(channel, onTunnelMessage)
  }, [session?.user?.id, conversationId, subscribe, isConnected])

  const sendMessage = useCallback(
    async (content: string, options?: Partial<SendMessageRequest>): Promise<Message | null> => {
      if (!session?.user?.id || !conversationId) return null

      try {
        const messageData = {
          content,
          type: options?.type || 'text',
          replyTo: options?.replyTo,
          attachments: options?.attachments,
        }

        const response: ApiResponse<Message> = await apiClient.post(
          `${API_BASE}/conversations/${conversationId}/messages`,
          messageData,
          {
            timeout: 10000,
            retries: 2,
          },
        )

        if (response.success && response.data) {
          const sent = response.data
          setMessages((prev) => {
            if (prev.some((p) => p.id === sent.id)) return prev
            return [...prev, sent]
          })
          return sent
        }

        throw new Error(response.error || 'Failed to send message')
      } catch (err) {
        if (err instanceof ApiClientError) {
          const errorMessage = err.message || 'Failed to send message'
          setError(errorMessage)
          console.error('Message send failed:', {
            endpoint: `/conversations/${conversationId}/messages`,
            statusCode: err.statusCode,
            conversationId,
            messageType: options?.type || 'text',
            context: err.context,
          })
        } else {
          setError(err instanceof Error ? err.message : 'Failed to send message')
          console.error('Unexpected error sending message:', err)
        }
        return null
      }
    },
    [session?.user?.id, conversationId],
  )

  const loadMore = useCallback(() => {
    if (hasMore && !loading && cursorRef.current) {
      void fetchMessages(false)
    }
  }, [hasMore, loading, fetchMessages])

  return {
    messages,
    loading,
    error,
    hasMore,
    sendMessage,
    loadMore,
    refresh: () => fetchMessages(true),
  }
}

export function useTyping(conversationId: string) {
  const { data: session } = useSession()
  const { subscribe, isConnected } = useTunnel()
  const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const lastTrueSentRef = useRef(0)

  const postTyping = useCallback(
    async (typing: boolean) => {
      if (!session?.user?.id || !conversationId) return
      setIsTyping(typing)
      try {
        await apiClient.post(
          `${API_BASE}/conversations/${conversationId}/typing`,
          { isTyping: typing },
          { timeout: 6000, retries: 0 },
        )
      } catch {
        // Non-fatal — typing is best-effort
      }
    },
    [session?.user?.id, conversationId],
  )

  const startTyping = useCallback(() => {
    const now = Date.now()
    if (now - lastTrueSentRef.current < 1500) return
    lastTrueSentRef.current = now
    void postTyping(true)
  }, [postTyping])

  const stopTyping = useCallback(() => {
    void postTyping(false)
  }, [postTyping])

  useEffect(() => {
    if (!conversationId || !session?.user?.id) {
      setTypingUsers([])
      return
    }

    const channel = `conversation:${conversationId}`
    const selfId = session.user.id

    const onTunnelMessage = (msg: TunnelMessage) => {
      if (msg.event !== 'typing:update' || !msg.payload || typeof msg.payload !== 'object') {
        return
      }
      const payload = msg.payload as { userId?: string; userName?: string; isTyping?: boolean }
      if (!payload.userId || payload.userId === selfId) return

      setTypingUsers((prev) => {
        const without = prev.filter((u) => u.userId !== payload.userId)
        if (!payload.isTyping) return without
        return [
          ...without,
          {
            conversationId,
            userId: payload.userId!,
            userName: payload.userName || 'User',
            timestamp: new Date(),
          },
        ]
      })
    }

    const unsubTunnel = subscribe(channel, onTunnelMessage)

    const cid = conversationId
    let cancelled = false
    const poll = async () => {
      if (isConnected) return
      try {
        const res: ApiResponse<{ typingUsers: TypingIndicator[] }> = await apiClient.get(
          `${API_BASE}/conversations/${cid}/typing`,
          {
            timeout: 6000,
            retries: 0,
          },
        )
        if (cancelled || !res.success || !res.data) return
        setTypingUsers(res.data.typingUsers || [])
      } catch {
        /* ignore */
      }
    }
    void poll()
    const id = setInterval(poll, isConnected ? 8000 : 2000)
    return () => {
      cancelled = true
      clearInterval(id)
      unsubTunnel()
      void apiClient.post(
        `${API_BASE}/conversations/${cid}/typing`,
        { isTyping: false },
        { timeout: 3000, retries: 0 },
      )
    }
  }, [conversationId, session?.user?.id, subscribe, isConnected])

  return {
    typingUsers,
    isTyping,
    startTyping,
    stopTyping,
  }
}

/** POST /api/conversations/[id]/read — call when a thread is focused / read. */
export function useMarkConversationRead(conversationId: string | null) {
  const { data: session } = useSession()
  const lastMarkRef = useRef(0)

  const markAsRead = useCallback(async () => {
    if (!session?.user?.id || !conversationId) return
    const now = Date.now()
    if (now - lastMarkRef.current < 4000) return
    lastMarkRef.current = now
    try {
      await apiClient.post(
        `${API_BASE}/conversations/${conversationId}/read`,
        {},
        { timeout: 8000, retries: 0 },
      )
    } catch {
      // best-effort
    }
  }, [session?.user?.id, conversationId])

  return { markAsRead }
}
