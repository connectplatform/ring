'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Loader2, Send, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import UnifiedLoginInline from '@/features/auth/components/unified-login-inline'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageBubble } from '@/features/chat/components/message-bubble'
import { STORE_AGENT_SENDER_ID } from '@/features/store/lib/product-agent-constants'
import { withProductAgentChatOpen } from '@/features/store/lib/product-agent-chat-url'
import { rememberProductAgentContext } from '@/features/store/components/product-agent-cart-summary'
import { ProductAgentCartSummaryBar } from '@/features/store/components/product-agent-cart-summary'
import { stripProductCardMarkersForDisplay } from '@/features/chat/lib/product-card-marker'
import { useProductAgentChat } from '@/hooks/use-product-agent-chat'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import type { Message } from '@/features/chat/types'
import { cn } from '@/lib/utils'

type LocalMsg = Pick<
  Message,
  'id' | 'conversationId' | 'senderId' | 'senderName' | 'content' | 'type' | 'status' | 'timestamp'
>

export function ProductAgentChatPanel({
  productId,
  productName,
  locale,
  className,
  showCartSummary = false,
}: {
  productId: string
  productName: string
  locale: Locale
  className?: string
  /** When true, render floating cart bar inside the panel (e.g. mobile shell). */
  showCartSummary?: boolean
}) {
  const t = useTranslations('modules.store')
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [draft, setDraft] = useState('')
  const [guestMessages, setGuestMessages] = useState<LocalMsg[]>([])
  const [guestSending, setGuestSending] = useState(false)
  const [guestError, setGuestError] = useState<string | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const {
    conversation,
    subject,
    bootstrapping,
    sending,
    streamingContent,
    toolStatus,
    error,
    sendMessage,
    messages,
    messagesLoading,
    isAuthenticated,
  } = useProductAgentChat(productId, status === 'authenticated')

  const loginReturnTo = useMemo(() => {
    if (typeof window === 'undefined') {
      return withProductAgentChatOpen(pathname, '')
    }
    return withProductAgentChatOpen(pathname, window.location.search)
  }, [pathname])

  useEffect(() => {
    rememberProductAgentContext(productId, productName)
  }, [productId, productName])

  useEffect(() => {
    if (status !== 'unauthenticated') return
    if (guestMessages.length > 0) return
    setGuestMessages([
      {
        id: 'guest-welcome',
        conversationId: 'guest',
        senderId: STORE_AGENT_SENDER_ID,
        senderName: t('product.aiSalesAssistant'),
        content: t('product.agentWelcome', { name: productName }),
        type: 'text',
        status: 'sent',
        timestamp: new Date().toISOString(),
      },
    ])
  }, [status, guestMessages.length, productName, t])

  const scrollChatToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const viewport = scrollAreaRef.current?.querySelector<HTMLElement>(
      '[data-radix-scroll-area-viewport]',
    )
    viewport?.scrollTo({ top: viewport.scrollHeight, behavior })
  }, [])

  useEffect(() => {
    scrollChatToBottom()
  }, [messages, streamingContent, guestMessages, scrollChatToBottom])

  const handleGuestSend = useCallback(async () => {
    if (!draft.trim() || guestSending) return
    const content = draft.trim()
    setDraft('')
    setGuestSending(true)
    setGuestError(null)

    const userMsg: LocalMsg = {
      id: `guest-u-${Date.now()}`,
      conversationId: 'guest',
      senderId: 'guest',
      senderName: 'You',
      content,
      type: 'text',
      status: 'sent',
      timestamp: new Date().toISOString(),
    }
    setGuestMessages((prev) => [...prev, userMsg])

    try {
      const response = await fetch(`/api/store/products/${productId}/agent-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, guest: true }),
      })
      const json = (await response.json().catch(() => ({}))) as {
        error?: string
        code?: string
        data?: { reply?: string }
      }
      if (!response.ok) {
        throw new Error(
          json.code === 'GUEST_LIMIT'
            ? t('product.agentGuestLimit')
            : json.error || `Request failed (${response.status})`,
        )
      }
      const reply = json.data?.reply || t('product.agentChatFallback')
      setGuestMessages((prev) => [
        ...prev,
        {
          id: `guest-a-${Date.now()}`,
          conversationId: 'guest',
          senderId: STORE_AGENT_SENDER_ID,
          senderName: t('product.aiSalesAssistant'),
          content: reply,
          type: 'text',
          status: 'sent',
          timestamp: new Date().toISOString(),
        },
      ])
    } catch (err) {
      setGuestError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setGuestSending(false)
    }
  }, [draft, guestSending, productId, t])

  const handleSend = useCallback(async () => {
    if (!draft.trim() || sending || !isAuthenticated) return
    const content = draft
    setDraft('')
    await sendMessage(content)
  }, [draft, sending, sendMessage, isAuthenticated])

  if (status === 'loading') {
    return (
      <div className={cn('flex flex-1 items-center justify-center p-6 text-muted-foreground', className)}>
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        {t('product.agentChatLoading')}
      </div>
    )
  }

  // Guest Q&A — limited tokens, productAgent-only (server). Sign-in for history + cart MCP.
  if (!isAuthenticated || !session?.user?.id) {
    return (
      <div className={cn('flex flex-col flex-1 min-h-0', className)}>
        <div className="border-b px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{productName}</p>
              <p className="text-xs text-muted-foreground">{t('product.aiSalesAssistant')}</p>
            </div>
          </div>
        </div>
        {showCartSummary ? (
          <ProductAgentCartSummaryBar locale={locale} productId={productId} />
        ) : null}
        <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0">
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground text-center">{t('product.agentChatSignIn')}</p>
            {guestMessages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message as Message}
                isOwn={message.senderId === 'guest'}
              />
            ))}
            {guestError ? <p className="text-sm text-destructive">{guestError}</p> : null}
            <div className="pt-2">
              <UnifiedLoginInline from={loginReturnTo} variant="default" locale={locale} />
            </div>
            <div ref={endRef} />
          </div>
        </ScrollArea>
        <div className="border-t p-3 shrink-0 bg-background">
          <div className="flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('product.agentChatPlaceholder', {
                defaultValue: 'Ask about this product…',
              })}
              className="min-h-[44px] max-h-28 resize-none"
              rows={2}
              disabled={guestSending}
              maxLength={500}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleGuestSend()
                }
              }}
            />
            <Button
              type="button"
              size="icon"
              disabled={!draft.trim() || guestSending}
              onClick={() => void handleGuestSend()}
              aria-label={t('product.chat')}
            >
              {guestSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (bootstrapping) {
    return (
      <div className={cn('flex flex-1 items-center justify-center p-6 text-muted-foreground', className)}>
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        {t('product.agentChatLoading')}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col flex-1 min-h-0', className)}>
      <div className="border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{subject || productName}</p>
            <p className="text-xs text-muted-foreground">{t('product.aiSalesAssistant')}</p>
          </div>
        </div>
        {conversation && (
          <Link
            href={`${ROUTES.MESSAGES(locale)}?c=${conversation.id}`}
            className="mt-2 inline-block text-xs text-primary hover:underline"
          >
            {t('product.openInMessenger', { defaultValue: 'Open in Ring Messenger' })}
          </Link>
        )}
      </div>

      {showCartSummary ? (
        <ProductAgentCartSummaryBar locale={locale} productId={productId} />
      ) : null}

      {error && (
        <div className="px-4 py-2 text-sm text-destructive border-b bg-destructive/5">{error}</div>
      )}
      {toolStatus && (
        <div className="px-4 py-1.5 text-xs text-muted-foreground border-b bg-muted/40">
          {toolStatus}
        </div>
      )}

      <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0">
        <div className="p-4 space-y-3">
          {messagesLoading && messages.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">
              {t('product.agentChatLoading')}
            </div>
          )}
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={message.senderId === session.user.id}
            />
          ))}
          {streamingContent !== null && (
            <MessageBubble
              message={{
                id: 'streaming-agent',
                conversationId: conversation?.id || '',
                senderId: STORE_AGENT_SENDER_ID,
                senderName: t('product.aiSalesAssistant'),
                content: stripProductCardMarkersForDisplay(streamingContent),
                type: 'text',
                status: 'sending',
                timestamp: new Date().toISOString(),
              }}
              isOwn={false}
            />
          )}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      <div className="border-t p-3 shrink-0 bg-background">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('product.agentChatPlaceholder', {
              defaultValue: 'Ask about this product…',
            })}
            className="min-h-[44px] max-h-28 resize-none"
            rows={2}
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            disabled={!draft.trim() || sending}
            onClick={() => void handleSend()}
            aria-label={t('product.chat')}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
