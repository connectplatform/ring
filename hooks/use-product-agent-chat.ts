'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { apiClient, type ApiResponse } from '@/lib/api-client'
import { useMessages } from '@/hooks/use-messaging'
import type { Conversation, Message } from '@/features/chat/types'

type AgentChatBootstrap = {
  conversation: Conversation
  subject: string
}

type AgentChatSendResult = {
  conversation: Conversation
  userMessage: Message
  agentMessage: Message
}

export function useProductAgentChat(productId: string, enabled = true) {
  const { data: session, status } = useSession()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [subject, setSubject] = useState('')
  const [bootstrapping, setBootstrapping] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const conversationId = conversation?.id || ''
  const messagesState = useMessages(conversationId, { limit: 50 })

  const bootstrap = useCallback(async () => {
    if (!enabled || !session?.user?.id || !productId) return

    setBootstrapping(true)
    setError(null)
    try {
      const response: ApiResponse<AgentChatBootstrap> = await apiClient.get(
        `/api/store/products/${productId}/agent-chat`,
        { timeout: 12000, retries: 1 },
      )
      if (response.success && response.data?.conversation) {
        setConversation(response.data.conversation)
        setSubject(response.data.subject || response.data.conversation.metadata.productName || '')
      } else {
        throw new Error(response.error || 'Failed to start product chat')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start product chat')
    } finally {
      setBootstrapping(false)
    }
  }, [enabled, productId, session?.user?.id])

  useEffect(() => {
    if (status !== 'authenticated') return
    if (conversation) return
    void bootstrap()
  }, [status, conversation, bootstrap])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!session?.user?.id || !productId || !content.trim()) return null

      setSending(true)
      setError(null)
      try {
        const response: ApiResponse<AgentChatSendResult> = await apiClient.post(
          `/api/store/products/${productId}/agent-chat`,
          { content: content.trim() },
          { timeout: 45000, retries: 0 },
        )

        if (!response.success || !response.data) {
          throw new Error(response.error || 'Failed to send message')
        }

        setConversation(response.data.conversation)
        setSubject(
          response.data.conversation.metadata.subject ||
            response.data.conversation.metadata.productName ||
            subject,
        )
        await messagesState.refresh()
        return response.data
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send message')
        return null
      } finally {
        setSending(false)
      }
    },
    [session?.user?.id, productId, messagesState, subject],
  )

  return {
    conversation,
    subject,
    bootstrapping,
    sending,
    error,
    bootstrap,
    sendMessage,
    messages: messagesState.messages,
    messagesLoading: messagesState.loading,
    refreshMessages: messagesState.refresh,
    isAuthenticated: status === 'authenticated',
  }
}
