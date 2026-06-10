'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Loader2, Send, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageBubble } from '@/features/chat/components/message-bubble'
import { STORE_AGENT_SENDER_ID } from '@/features/store/services/product-agent-service'
import { useProductAgentChat } from '@/hooks/use-product-agent-chat'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import { cn } from '@/lib/utils'
import { signIn } from 'next-auth/react'

export function ProductAgentChatPanel({
  productId,
  productName,
  locale,
  className,
}: {
  productId: string
  productName: string
  locale: Locale
  className?: string
}) {
  const t = useTranslations('modules.store')
  const { data: session, status } = useSession()
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const {
    conversation,
    subject,
    bootstrapping,
    sending,
    streamingContent,
    error,
    sendMessage,
    messages,
    messagesLoading,
    isAuthenticated,
  } = useProductAgentChat(productId)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending, streamingContent])

  const handleSend = useCallback(async () => {
    if (!draft.trim() || sending) return
    const content = draft
    setDraft('')
    await sendMessage(content)
  }, [draft, sending, sendMessage])

  if (status === 'loading' || bootstrapping) {
    return (
      <div className={cn('flex flex-1 items-center justify-center p-6 text-muted-foreground', className)}>
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        {t('product.agentChatLoading')}
      </div>
    )
  }

  if (!isAuthenticated || !session?.user?.id) {
    return (
      <div className={cn('flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center', className)}>
        <Sparkles className="h-10 w-10 text-purple-500" />
        <p className="text-sm text-muted-foreground">{t('product.agentChatSignIn')}</p>
        <Button onClick={() => void signIn(undefined, { callbackUrl: window.location.href })}>
          {t('product.agentChatSignInAction')}
        </Button>
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
            {t('product.openInMessenger')}
          </Link>
        )}
      </div>

      {error && (
        <div className="px-4 py-2 text-sm text-destructive border-b bg-destructive/5">{error}</div>
      )}

      <ScrollArea className="flex-1 min-h-0">
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
                content: streamingContent,
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
            placeholder={t('product.agentChatPlaceholder')}
            className="min-h-[44px] max-h-28 resize-none"
            rows={2}
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
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
