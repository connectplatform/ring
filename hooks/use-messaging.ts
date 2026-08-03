'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useTunnelChannel } from '@/hooks/use-tunnel-channel'
import { useTunnel } from '@/hooks/use-tunnel'
import { apiClient, ApiClientError, type ApiResponse } from '@/lib/api-client'
import { normalizeMessagePayload } from '@/features/chat/lib/normalize-message'
import { getMessageTimeMs } from '@/features/chat/lib/message-time'
import {
  CONVERSATION_MESSAGE_EVENT,
  type ConversationMessageDetail,
} from '@/features/chat/lib/conversation-message-events'
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

/** Soft catch-up: add missing rows from a latest-page fetch without wiping older pages. */
function mergeCatchUpMessages(prev: Message[], latestPage: Message[]): Message[] {
  if (latestPage.length === 0) return prev
  const byId = new Map(prev.map((m) => [m.id, m]))
  let changed = false
  for (const m of latestPage) {
    if (!byId.has(m.id)) {
      byId.set(m.id, m)
      changed = true
    }
  }
  if (!changed) return prev
  return Array.from(byId.values()).sort(
    (a, b) => getMessageTimeMs(a.timestamp) - getMessageTimeMs(b.timestamp),
  )
}

function appendMessageIfNew(prev: Message[], incoming: Message): Message[] {
  if (prev.some((p) => p.id === incoming.id)) return prev
  return [...prev, incoming]
}

export type UseConversationsResult = {
  conversations: Conversation[]
  loading: boolean
  error: string | null
  hasMore: boolean
  createConversation: (data: CreateConversationRequest) => Promise<Conversation | null>
  loadMore: () => void
  refresh: () => Promise<void>
  clearUnread: (conversationId: string) => void
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

  // Live unread / last-message patches from user tunnel (MessageService fan-out).
  // UPGRADE: virtualize roster + apply patches via useOptimistic when list is huge.
  const handleInboxTunnel = useCallback(
    (msg: TunnelMessage) => {
      const payload = msg.payload as
        | {
            action?: string
            conversationId?: string
            message?: {
              id: string
              content: string
              senderId: string
              senderName: string
              timestamp: number | string | Date
              type?: Message['type']
            }
          }
        | undefined
      if (!payload?.conversationId || payload.action !== 'message:new' || !payload.message) {
        return
      }
      const cid = payload.conversationId
      const selfId = session?.user?.id
      const incoming = payload.message
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== cid) return c
          const bump =
            incoming.senderId !== selfId ? (c.unreadCount ?? 0) + 1 : (c.unreadCount ?? 0)
          return {
            ...c,
            unreadCount: bump,
            lastMessage: {
              id: incoming.id,
              conversationId: cid,
              content: incoming.content,
              senderId: incoming.senderId,
              senderName: incoming.senderName,
              timestamp: new Date(incoming.timestamp),
              type: incoming.type || 'text',
              status: 'sent',
            } as Message,
            updatedAt: new Date(),
          }
        }),
      )
    },
    [session?.user?.id],
  )

  useTunnelChannel({
    channel: 'conversations:inbox',
    enabled: Boolean(session?.user?.id),
    onTunnelMessage: handleInboxTunnel,
  })

  const clearUnread = useCallback((conversationId: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
    )
  }, [])

  return {
    conversations,
    loading,
    error,
    hasMore,
    createConversation,
    loadMore,
    refresh,
    clearUnread,
  }
}

export function useConversation(conversationId: string, options?: { enabled?: boolean }) {
  const { data: session } = useSession()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const enabled = options?.enabled !== false

  const fetchConversation = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!session?.user?.id || !conversationId) return

      try {
        if (!opts?.silent) {
          setLoading(true)
        }
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
        if (!opts?.silent) {
          setLoading(false)
        }
      }
    },
    [session?.user?.id, conversationId],
  )

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    if (!session?.user?.id || !conversationId) return
    void fetchConversation()
  }, [session?.user?.id, conversationId, enabled, fetchConversation])

  const refresh = useCallback(() => fetchConversation({ silent: true }), [fetchConversation])

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
    refresh,
  }
}

export function useMessages(conversationId: string, pagination?: PaginationOptions) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  const cursorRef = useRef<string | null>(null)
  const conversationIdRef = useRef(conversationId)
  conversationIdRef.current = conversationId
  const limit = pagination?.limit ?? 50
  const direction = pagination?.direction

  useEffect(() => {
    cursorRef.current = null
  }, [conversationId])

  const fetchMessages = useCallback(
    async (reset = false, options?: { quiet?: boolean }) => {
      if (!session?.user?.id || !conversationId) {
        setLoading(false)
        return
      }

      const quiet = Boolean(options?.quiet)

      try {
        if (!quiet) {
          setLoading(true)
          setError(null)
        }

        // Quiet catch-up always reads the latest page (no cursor) and merges — never wipe history.
        if (quiet) {
          const params = new URLSearchParams()
          params.set('limit', String(limit))
          if (direction) params.set('direction', direction)

          const response: ApiResponse<Message[]> = await apiClient.get(
            `${API_BASE}/conversations/${conversationId}/messages?${params}`,
            { timeout: 8000, retries: 1 },
          )
          if (response.success) {
            const list = Array.isArray(response.data) ? response.data : []
            setMessages((prev) => mergeCatchUpMessages(prev, list))
          }
          return
        }

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
        if (quiet) {
          // Tunnel-down catch-up is best-effort — do not surface transient errors.
          return
        }
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
        if (!quiet) {
          setLoading(false)
        }
      }
    },
    [session?.user?.id, conversationId, limit, direction],
  )

  useEffect(() => {
    void fetchMessages(true)
  }, [fetchMessages])

  const handleConversationMessage = useCallback((msg: TunnelMessage) => {
    const cid = conversationIdRef.current
    const event = msg.event
    if (event === 'message:new' && msg.payload) {
      const incoming = normalizeMessagePayload(msg.payload, cid)
      if (!incoming) return
      setMessages((prev) => appendMessageIfNew(prev, incoming))
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
      const incoming = normalizeMessagePayload(msg.payload, cid)
      if (!incoming) return
      setMessages((prev) => {
        const idx = prev.findIndex((p) => p.id === incoming.id)
        if (idx === -1) return [...prev, incoming]
        const next = [...prev]
        next[idx] = { ...next[idx], ...incoming }
        return next
      })
    }
  }, [])

  const { isConnected: isTunnelConnected } = useTunnelChannel({
    channel: `conversation:${conversationId}`,
    enabled: Boolean(session?.user?.id && conversationId),
    onTunnelMessage: handleConversationMessage,
  })

  // Local append from call-invite / call-event HTTP (when tunnel fan-out is missed)
  useEffect(() => {
    const onLocal = (event: Event) => {
      const detail = (event as CustomEvent<ConversationMessageDetail>).detail
      if (!detail?.message?.id) return
      if (detail.conversationId !== conversationIdRef.current) return
      const incoming = normalizeMessagePayload(detail.message, conversationIdRef.current)
      if (!incoming) return
      setMessages((prev) => appendMessageIfNew(prev, incoming))
    }
    window.addEventListener(CONVERSATION_MESSAGE_EVENT, onLocal)
    return () => window.removeEventListener(CONVERSATION_MESSAGE_EVENT, onLocal)
  }, [])

  // Tunnel-down safety net — quiet catch-up merges latest page; never wipes loaded history
  useEffect(() => {
    if (!session?.user?.id || !conversationId || isTunnelConnected) return
    const id = window.setInterval(() => {
      void fetchMessages(false, { quiet: true })
    }, 12_000)
    return () => window.clearInterval(id)
  }, [session?.user?.id, conversationId, isTunnelConnected, fetchMessages])

  const sendMessage = useCallback(
    async (content: string, options?: Partial<SendMessageRequest>): Promise<Message | null> => {
      if (!session?.user?.id || !conversationId) return null

      try {
        const messageData = {
          content,
          type: options?.type || 'text',
          replyTo: options?.replyTo,
          attachments: options?.attachments,
          ...(options?.metadata ? { metadata: options.metadata } : {}),
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
          const listFromMeta = response.metadata?.dataList
          const list: Message[] = Array.isArray(listFromMeta)
            ? (listFromMeta as Message[])
            : [response.data]
          setMessages((prev) => list.reduce((acc, msg) => appendMessageIfNew(acc, msg), prev))
          return list[list.length - 1] ?? response.data
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
  const { isConnected } = useTunnel()
  const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const lastTrueSentRef = useRef(0)

  const conversationIdRef = useRef(conversationId)
  conversationIdRef.current = conversationId
  const selfIdRef = useRef(session?.user?.id)
  selfIdRef.current = session?.user?.id

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

  const handleTypingMessage = useCallback((msg: TunnelMessage) => {
    if (msg.event !== 'typing:update' || !msg.payload || typeof msg.payload !== 'object') {
      return
    }
    const payload = msg.payload as { userId?: string; userName?: string; isTyping?: boolean }
    const selfId = selfIdRef.current
    if (!payload.userId || payload.userId === selfId) return

    const cid = conversationIdRef.current
    setTypingUsers((prev) => {
      const without = prev.filter((u) => u.userId !== payload.userId)
      if (!payload.isTyping) return without
      return [
        ...without,
        {
          conversationId: cid,
          userId: payload.userId!,
          userName: payload.userName || 'User',
          timestamp: new Date(),
        },
      ]
    })
  }, [])

  useTunnelChannel({
    channel: `conversation:${conversationId}`,
    enabled: Boolean(session?.user?.id && conversationId),
    onTunnelMessage: handleTypingMessage,
  })

  useEffect(() => {
    if (!conversationId || !session?.user?.id) {
      setTypingUsers([])
      return
    }

    const cid = conversationId
    return () => {
      void apiClient.post(
        `${API_BASE}/conversations/${cid}/typing`,
        { isTyping: false },
        { timeout: 3000, retries: 0 },
      )
    }
  }, [conversationId, session?.user?.id])

  // HTTP typing poll only when tunnel is down — tunnel channel owns live updates otherwise.
  useEffect(() => {
    if (!conversationId || !session?.user?.id || isConnected) return

    const cid = conversationId
    let cancelled = false
    const poll = async () => {
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
    const id = setInterval(poll, 2000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [conversationId, session?.user?.id, isConnected])

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
