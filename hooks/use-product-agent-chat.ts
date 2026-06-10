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

type StreamEvent =
  | { type: 'userMessage'; message: Message; conversation: Conversation }
  | { type: 'token'; content: string }
  | { type: 'done'; agentMessage: Message; conversation: Conversation }
  | { type: 'error'; error?: string }

export function useProductAgentChat(productId: string, enabled = true) {
  const { data: session, status } = useSession()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [subject, setSubject] = useState('')
  const [bootstrapping, setBootstrapping] = useState(false)
  const [sending, setSending] = useState(false)
  const [streamingContent, setStreamingContent] = useState<string | null>(null)
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
      setStreamingContent('')
      setError(null)

      try {
        const response = await fetch(`/api/store/products/${productId}/agent-chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({ content: content.trim(), stream: true }),
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw new Error((err as { error?: string }).error || `Request failed (${response.status})`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No stream available')
        }

        const decoder = new TextDecoder()
        let buffer = ''
        let result: AgentChatSendResult | null = null
        let pendingUserMessage: Message | null = null

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue

            let event: StreamEvent
            try {
              event = JSON.parse(line.slice(6)) as StreamEvent
            } catch {
              continue
            }

            if (event.type === 'userMessage') {
              pendingUserMessage = event.message
              setConversation(event.conversation)
              setSubject(
                event.conversation.metadata.subject ||
                  event.conversation.metadata.productName ||
                  subject,
              )
            } else if (event.type === 'token' && event.content) {
              setStreamingContent((prev) => `${prev ?? ''}${event.content}`)
            } else if (event.type === 'done') {
              setConversation(event.conversation)
              result = {
                conversation: event.conversation,
                userMessage: pendingUserMessage!,
                agentMessage: event.agentMessage,
              }
            } else if (event.type === 'error') {
              throw new Error(event.error || 'Stream error')
            }
          }
        }

        setStreamingContent(null)
        await messagesState.refresh()
        return result
      } catch (err) {
        setStreamingContent(null)
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
    streamingContent,
    error,
    bootstrap,
    sendMessage,
    messages: messagesState.messages,
    messagesLoading: messagesState.loading,
    refreshMessages: messagesState.refresh,
    isAuthenticated: status === 'authenticated',
  }
}
