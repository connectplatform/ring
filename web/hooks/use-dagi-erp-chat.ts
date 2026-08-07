'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { apiClient, type ApiResponse } from '@/lib/api-client'
import { useMessages } from '@/hooks/use-messaging'
import type { Conversation, Message } from '@/features/chat/types'

type DagiChatBootstrap = {
  conversation: Conversation
  vendorEntityId: string
  vendorName: string
  subject: string
}

type StreamEvent =
  | { type: 'userMessage'; message: Message; conversation: Conversation }
  | { type: 'token'; content: string }
  | { type: 'tool_status'; tools?: string[]; message?: string }
  | {
      type: 'done'
      agentMessage: Message
      conversation: Conversation
      toolsUsed?: string[]
    }
  | { type: 'error'; error?: string }

export function useDagiErpChat(vendorEntityId: string, enabled = true) {
  const { data: session, status } = useSession()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [vendorName, setVendorName] = useState('')
  const [subject, setSubject] = useState('')
  const [bootstrapping, setBootstrapping] = useState(false)
  const [sending, setSending] = useState(false)
  const [streamingContent, setStreamingContent] = useState<string | null>(null)
  const [toolStatus, setToolStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const conversationId = conversation?.id || ''
  const messagesState = useMessages(conversationId, { limit: 50 })

  const bootstrap = useCallback(async () => {
    if (!enabled || !session?.user?.id || !vendorEntityId) return

    setBootstrapping(true)
    setError(null)
    try {
      const response: ApiResponse<DagiChatBootstrap> = await apiClient.get(
        `/api/vendor/dagi/chat?vendorEntityId=${encodeURIComponent(vendorEntityId)}`,
        { timeout: 12000, retries: 1 },
      )
      if (response.success && response.data?.conversation) {
        setConversation(response.data.conversation)
        setVendorName(response.data.vendorName || '')
        setSubject(response.data.subject || '')
      } else {
        throw new Error(response.error || 'Failed to start DAGI chat')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start DAGI chat')
    } finally {
      setBootstrapping(false)
    }
  }, [enabled, session?.user?.id, vendorEntityId])

  useEffect(() => {
    if (status !== 'authenticated') return
    if (!enabled) return
    if (conversation) return
    void bootstrap()
  }, [status, enabled, conversation, bootstrap])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!session?.user?.id || !vendorEntityId || !content.trim()) return null

      setSending(true)
      setStreamingContent('')
      setToolStatus(null)
      setError(null)

      try {
        const response = await fetch('/api/vendor/dagi/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({
            content: content.trim(),
            vendorEntityId,
            stream: true,
          }),
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw new Error((err as { error?: string }).error || `Request failed (${response.status})`)
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('No stream available')

        const decoder = new TextDecoder()
        let buffer = ''
        let result: { conversation: Conversation; agentMessage: Message } | null = null

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
              setConversation(event.conversation)
            } else if (event.type === 'tool_status') {
              setToolStatus(event.message || 'Working…')
            } else if (event.type === 'token' && event.content) {
              setStreamingContent((prev) => `${prev ?? ''}${event.content}`)
            } else if (event.type === 'done') {
              setConversation(event.conversation)
              result = {
                conversation: event.conversation,
                agentMessage: event.agentMessage,
              }
            } else if (event.type === 'error') {
              throw new Error(event.error || 'DAGI chat failed')
            }
          }
        }

        setStreamingContent(null)
        setToolStatus(null)
        await messagesState.refresh()
        return result
      } catch (err) {
        setStreamingContent(null)
        setToolStatus(null)
        setError(err instanceof Error ? err.message : 'Failed to send message')
        return null
      } finally {
        setSending(false)
      }
    },
    [session?.user?.id, vendorEntityId, messagesState],
  )

  return {
    conversation,
    vendorName,
    subject,
    bootstrapping,
    sending,
    streamingContent,
    toolStatus,
    error,
    bootstrap,
    sendMessage,
    messages: messagesState.messages,
    messagesLoading: messagesState.loading,
    refreshMessages: messagesState.refresh,
    isAuthenticated: status === 'authenticated',
  }
}
