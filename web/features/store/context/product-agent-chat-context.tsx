'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useSession } from 'next-auth/react'
import { apiClient } from '@/lib/api-client'
import { useTunnelChannel } from '@/hooks/use-tunnel-channel'
import { normalizeMessagePayload } from '@/features/chat/lib/normalize-message'
import type { TunnelMessage } from '@/lib/tunnel/types'
import {
  isProductAgentChatOpenParam,
  PRODUCT_AGENT_CHAT_OPEN_PARAM,
} from '@/features/store/lib/product-agent-chat-url'

type ProductAgentChatContextValue = {
  productId: string
  productName: string
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  /** Server conversation id for this (user, product) chat — set by panel bootstrap. */
  conversationId: string
  /**
   * Unread SSOT for this product chat: server `conversation.unreadCount`
   * seeded at bootstrap, bumped live by the user tunnel while the chat is
   * closed, cleared via `mark_read` when the chat is seen.
   */
  unreadCount: number
  /** Panel reports the bootstrapped conversation (id + initial server unread). */
  registerConversation: (conversationId: string, unreadCount?: number) => void
  /** Clears local badge + calls server `mark_read` (best-effort). */
  markRead: () => void
}

const ProductAgentChatContext = createContext<ProductAgentChatContextValue | null>(null)

export function ProductAgentChatProvider({
  productId,
  productName,
  children,
}: {
  productId: string
  productName: string
  children: ReactNode
}) {
  const { data: session, status } = useSession()
  const [open, setOpen] = useState(false)
  const [conversationId, setConversationId] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)

  const conversationIdRef = useRef('')
  conversationIdRef.current = conversationId
  const unreadRef = useRef(0)
  const selfIdRef = useRef<string | undefined>(undefined)
  selfIdRef.current = session?.user?.id

  const registerConversation = useCallback((id: string, initialUnread?: number) => {
    conversationIdRef.current = id
    setConversationId(id)
    setUnreadCount((prev) => {
      // Keep a live bump that raced ahead of bootstrap registration.
      const next = initialUnread !== undefined && prev === 0 ? initialUnread : prev
      unreadRef.current = next
      return next
    })
  }, [])

  const markRead = useCallback(() => {
    if (unreadRef.current === 0) return
    unreadRef.current = 0
    setUnreadCount(0)
    const id = conversationIdRef.current
    if (!id) return
    void apiClient
      .put(`/api/conversations/${id}`, { action: 'mark_read' }, { timeout: 8000, retries: 1 })
      .catch(() => {
        // Best-effort — the local badge is already cleared; server catches up.
      })
  }, [])

  // Cold-start bootstrap (idempotent get-or-create): seeds the unread badge
  // even before the chat panel mounts (mobile FAB before first open). The
  // panel's own bootstrap converges on the same conversation.
  const bootstrappedRef = useRef(false)
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id || !productId) return
    if (bootstrappedRef.current || conversationIdRef.current) return
    bootstrappedRef.current = true
    let cancelled = false
    apiClient
      .get<{ conversation?: { id: string; unreadCount?: number } }>(
        `/api/store/products/${productId}/agent-chat`,
        { timeout: 12000, retries: 1 },
      )
      .then((res) => {
        if (cancelled || !res.success || !res.data?.conversation) return
        registerConversation(res.data.conversation.id, res.data.conversation.unreadCount ?? 0)
      })
      .catch(() => {
        // Silent — the panel bootstrap is the fallback path for the same endpoint.
      })
    return () => {
      cancelled = true
    }
  }, [status, session?.user?.id, productId, registerConversation])

  // Seen semantics: opening the chat clears prior unread; closing clears
  // anything that arrived while it was open and rendered by the panel.
  const prevOpenRef = useRef(false)
  useEffect(() => {
    const wasOpen = prevOpenRef.current
    prevOpenRef.current = open
    if (conversationId && (open || wasOpen)) markRead()
  }, [open, conversationId, markRead])

  // Live unread bumps while the chat is closed. While open the panel renders
  // messages directly and clears via markRead on close — no double counting.
  const handleTunnelMessage = useCallback((msg: TunnelMessage) => {
    if (msg.event !== 'message:new' || !msg.payload) return
    const incoming = normalizeMessagePayload(msg.payload, conversationIdRef.current)
    if (!incoming || incoming.senderId === selfIdRef.current) return
    unreadRef.current += 1
    setUnreadCount(unreadRef.current)
  }, [])

  useTunnelChannel({
    channel: `conversation:${conversationId}`,
    enabled: Boolean(conversationId) && !open,
    onTunnelMessage: handleTunnelMessage,
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (isProductAgentChatOpenParam(params.get(PRODUCT_AGENT_CHAT_OPEN_PARAM))) {
      setOpen(true)
    }
  }, [])

  const value = useMemo(
    () => ({
      productId,
      productName,
      open,
      setOpen,
      toggle: () => setOpen((prev) => !prev),
      conversationId,
      unreadCount,
      registerConversation,
      markRead,
    }),
    [productId, productName, open, conversationId, unreadCount, registerConversation, markRead],
  )

  return <ProductAgentChatContext.Provider value={value}>{children}</ProductAgentChatContext.Provider>
}

export function useProductAgentChatContext() {
  const context = useContext(ProductAgentChatContext)
  if (!context) {
    throw new Error('useProductAgentChatContext must be used within ProductAgentChatProvider')
  }
  return context
}

export function useOptionalProductAgentChatContext() {
  return useContext(ProductAgentChatContext)
}
