'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { MessageCircle, ArrowLeft, Radio } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ConversationList } from '@/features/chat/components/conversation-list'
import { ConversationHeader } from '@/features/chat/components/conversation-header'
import { MessageThread } from '@/features/chat/components/message-thread'
import { NewConversationDialog } from '@/features/chat/components/new-conversation-dialog'
import { useConversation, useConversations } from '@/hooks/use-messaging'
import { useTunnel } from '@/hooks/use-tunnel'
import { signIn } from 'next-auth/react'
import { cn } from '@/lib/utils'

/**
 * Ring Messenger — full list + thread UI over existing conversation APIs, with Ring Tunnel for live `conversation:{id}` events.
 */
export default function MessagesContent() {
  const t = useTranslations('common')
  const router = useRouter()
  const { data: session, status } = useSession()
  const { isConnected, connectionState, provider, latency, error: tunnelError } = useTunnel()
  const searchParams = useSearchParams()
  const paramC = searchParams.get('c')
  const paramUser = searchParams.get('user')

  const [selectedId, setSelectedId] = useState<string | null>(paramC)
  const [showListMobile, setShowListMobile] = useState(true)
  const [showNewConv, setShowNewConv] = useState(false)
  const deepLinkHandledRef = useRef<string | null>(null)

  const inbox = useConversations()
  const { refresh: refreshInbox, createConversation, conversations } = inbox
  const { conversation, loading: convLoad } = useConversation(selectedId || '', {
    enabled: !!selectedId,
  })

  useEffect(() => {
    if (paramC) setSelectedId(paramC)
  }, [paramC])

  const openDirectConversation = useCallback(
    async (targetUserId: string) => {
      if (!session?.user?.id || targetUserId === session.user.id) return

      const existing = conversations.find(
        (conv) =>
          conv.type === 'direct' &&
          conv.participants.some((p) => p.userId === targetUserId),
      )

      if (existing) {
        setSelectedId(existing.id)
        setShowListMobile(false)
        return
      }

      const created = await createConversation({
        type: 'direct',
        participantIds: [targetUserId],
        metadata: { directUserId: targetUserId },
      })

      if (created) {
        setSelectedId(created.id)
        setShowListMobile(false)
      }
    },
    [session?.user?.id, conversations, createConversation],
  )

  useEffect(() => {
    if (!paramUser || !session?.user?.id) return
    if (deepLinkHandledRef.current === paramUser) return
    if (inbox.loading) return

    deepLinkHandledRef.current = paramUser
    void openDirectConversation(paramUser)
  }, [paramUser, session?.user?.id, inbox.loading, openDirectConversation])

  const onSelect = useCallback(
    (id: string) => {
      const conversation = conversations.find((conv) => conv.id === id)
      if (conversation?.type === 'product' && conversation.metadata.productId) {
        router.push({
          pathname: '/store/[id]',
          params: { id: conversation.metadata.productId },
        })
        return
      }

      setSelectedId(id)
      setShowListMobile(false)
      void refreshInbox()
    },
    [conversations, refreshInbox, router],
  )

  const onBack = useCallback(() => {
    setShowListMobile(true)
  }, [])

  if (status === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground min-h-[320px]">
        Loading…
      </div>
    )
  }

  if (status !== 'authenticated' || !session?.user?.id) {
    return (
      <Card className="flex-1 flex flex-col items-center justify-center p-8 min-h-[400px]">
        <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" aria-hidden />
        <h2 className="text-lg font-semibold mb-2">Sign in to use Ring Messenger</h2>
        <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
          Your conversations, typing indicators, and attachments use the same secure APIs as the rest of the platform.
        </p>
        <Button
          onClick={() =>
            void signIn(undefined, { callbackUrl: window.location.href })
          }
        >
          {t('actions.signIn')}
        </Button>
      </Card>
    )
  }

  const userId = session.user.id

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <MessageCircle className="h-5 w-5" aria-hidden />
          Ring Messenger
        </h1>
        <div
          className="flex items-center gap-2 text-xs text-muted-foreground"
          title="Ring tunnel transport (realtime push for this session)"
        >
          <Radio
            className={cn('h-3.5 w-3.5', isConnected ? 'text-emerald-500' : 'text-amber-500')}
            aria-hidden
          />
          <span>
            {isConnected ? 'Tunnel live' : 'Tunnel offline'} {provider ? `· ${provider}` : ''}
            {typeof latency === 'number' && latency > 0 ? ` · ${Math.round(latency)}ms` : ''}
            {connectionState && ` · ${connectionState}`}
          </span>
        </div>
      </div>

      {tunnelError && (
        <Alert variant="destructive">
          <AlertDescription>Realtime connection issue: {tunnelError.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex-1 flex min-h-0 border rounded-lg overflow-hidden bg-card">
        {/* Left: list — full width on small screens when a thread is not shown */}
        <div
          className={cn(
            'w-full md:w-80 border-r flex flex-col min-h-0 shrink-0',
            !showListMobile && selectedId && 'hidden md:flex'
          )}
        >
          <ConversationList
            userId={userId}
            inbox={inbox}
            selectedConversationId={selectedId || undefined}
            onConversationSelectAction={onSelect}
            onNewConversationAction={() => setShowNewConv(true)}
            className="h-full"
          />
        </div>

        {/* Right: thread */}
        <div
          className={cn(
            'flex-1 flex flex-col min-w-0 min-h-0',
            showListMobile && selectedId && 'hidden md:flex'
          )}
        >
          {!selectedId && (
            <div className="flex-1 flex items-center justify-center p-6 text-sm text-muted-foreground">
              Select a conversation to read and send messages.
            </div>
          )}

          {selectedId && (convLoad && !conversation) && (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Loading conversation…
            </div>
          )}

          {selectedId && conversation && (
            <>
              <div className="md:hidden border-b p-1 flex items-center">
                <Button type="button" variant="ghost" size="sm" onClick={onBack} className="gap-1">
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  Inbox
                </Button>
              </div>
              <ConversationHeader conversation={conversation} currentUserId={userId} />
              <div className="flex-1 min-h-0 flex flex-col">
                <MessageThread
                  key={selectedId}
                  conversationId={selectedId}
                  userId={userId}
                  conversation={conversation}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <NewConversationDialog
        open={showNewConv}
        onOpenChangeAction={setShowNewConv}
        createConversation={createConversation}
        onConversationCreatedAction={onSelect}
      />
    </div>
  )
}
