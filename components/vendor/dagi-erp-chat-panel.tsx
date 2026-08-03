'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageBubble } from '@/features/chat/components/message-bubble'
import { DAGI_AGENT_SENDER_ID } from '@/features/store/lib/dagi-agent-constants'
import { useDagiErpChat } from '@/hooks/use-dagi-erp-chat'
import type { Locale } from '@/i18n/shared'
import { cn } from '@/lib/utils'

export function DagiErpChatPanel({
  vendorEntityId,
  vendorName,
  locale,
  className,
}: {
  vendorEntityId: string
  vendorName?: string
  locale: Locale
  className?: string
}) {
  const t = useTranslations('vendor.dashboard.dagi')
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const {
    conversation,
    subject,
    vendorName: boundName,
    bootstrapping,
    sending,
    streamingContent,
    toolStatus,
    error,
    sendMessage,
    messages,
    messagesLoading,
  } = useDagiErpChat(vendorEntityId, Boolean(vendorEntityId))

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent, toolStatus])

  const onSend = useCallback(async () => {
    const text = draft.trim()
    if (!text || sending) return
    setDraft('')
    await sendMessage(text)
  }, [draft, sending, sendMessage])

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border bg-background min-h-[320px] max-h-[480px]',
        className,
      )}
    >
      <div className="border-b px-3 py-2">
        <p className="text-sm font-medium">{subject || t('chatTitle')}</p>
        <p className="text-xs text-muted-foreground">
          {boundName || vendorName || vendorEntityId}
        </p>
      </div>

      <ScrollArea className="flex-1 px-3 py-2">
        {bootstrapping || messagesLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('chatLoading')}
          </div>
        ) : (
          <div className="space-y-3 py-2">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={message.senderId !== DAGI_AGENT_SENDER_ID}
              />
            ))}
            {streamingContent ? (
              <MessageBubble
                message={{
                  id: 'streaming',
                  conversationId: conversation?.id || 'pending',
                  senderId: DAGI_AGENT_SENDER_ID,
                  senderName: 'DAGI',
                  content: streamingContent,
                  type: 'text',
                  status: 'sent',
                  timestamp: new Date().toISOString(),
                }}
                isOwn={false}
              />
            ) : null}
            {toolStatus ? (
              <p className="text-xs text-muted-foreground animate-pulse">{toolStatus}</p>
            ) : null}
            <div ref={endRef} />
          </div>
        )}
      </ScrollArea>

      {error ? <p className="px-3 text-xs text-destructive">{error}</p> : null}

      <div className="border-t p-3 flex gap-2 items-end">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('chatPlaceholder')}
          className="min-h-[44px] max-h-28 resize-none"
          disabled={sending || bootstrapping}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void onSend()
            }
          }}
        />
        <Button
          type="button"
          size="icon"
          disabled={sending || !draft.trim()}
          onClick={() => void onSend()}
          aria-label={t('chatSend')}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      {/* locale kept for future i18n density; panel uses next-intl namespace */}
      <span className="sr-only">{locale}</span>
    </div>
  )
}

export default DagiErpChatPanel
