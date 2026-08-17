'use client'

/**
 * MessagesShell — Ring Messenger layout SSOT
 * Right rail: Messages title + +, search, full-height conversation roster
 *   (direct, entity, opportunity, and product/DAGI agent chats).
 * Center: borderless DaVinci thread on select.
 */

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn, useSession } from 'next-auth/react'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeft, MessageCircle } from 'lucide-react'
import { useRouter } from '@/i18n/routing'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import { MessagesSidebarContent } from '@/components/layout/rails/messages-rail'
import { TunnelIndicatorCompact } from '@/components/navigation/tunnel-indicator'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConversationHeader } from '@/features/chat/components/conversation-header'
import { CallOverlay } from '@/features/chat/components/call-overlay'
import { GroupMembersDialog } from '@/features/chat/components/group-members-dialog'
import { MessageThread } from '@/features/chat/components/message-thread'
import { NewConversationDialog } from '@/features/chat/components/new-conversation-dialog'
import { openOrCreateDirectConversation } from '@/features/chat/lib/open-or-create-direct'
import { getConversationTitle } from '@/features/chat/lib/conversation-display'
import { useConversation, useConversations } from '@/hooks/use-messaging'
import {
  useWebRtcCall,
} from '@/hooks/use-webrtc-call'
import { usePeerGameBusy, setPeerCallBusy } from '@/features/peer-games/lib/peer-game-mutex'
import { useCallSession } from '@/features/chat/providers/call-session-provider'
import { apiClient } from '@/lib/api-client'
import { toast } from '@/hooks/use-toast'
import type { Locale } from '@/i18n/shared'

export default function MessagesShell() {
  const t = useTranslations('common')
  const tMessenger = useTranslations('modules.messenger')
  const locale = useLocale() as Locale
  const router = useRouter()
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const paramC = searchParams.get('c') || searchParams.get('conversation')
  const paramUser = searchParams.get('user')

  const [selectedId, setSelectedId] = useState<string | null>(paramC)
  const [railOpen, setRailOpen] = useState(false)
  const [showNewConv, setShowNewConv] = useState(false)
  const [showGroupMembers, setShowGroupMembers] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const deepLinkHandledRef = useRef<string | null>(null)
  const userId = session?.user?.id ?? ''
  const gameBusy = usePeerGameBusy()
  const { pendingInvite, setPendingInvite } = useCallSession()
  const injectedInvite = pendingInvite

  const inbox = useConversations()
  const { refresh: refreshInbox, createConversation, conversations, clearUnread } = inbox
  const {
    conversation: fetchedConversation,
    loading: convLoad,
    error: convError,
    refresh: refreshConversation,
  } = useConversation(selectedId || '', {
    enabled: !!selectedId,
  })

  // Prefer detail fetch; fall back to inbox row so the thread chrome never blanks
  const conversation = useMemo(() => {
    if (fetchedConversation) return fetchedConversation
    if (!selectedId) return null
    return conversations.find((c) => c.id === selectedId) ?? null
  }, [fetchedConversation, conversations, selectedId])

  const callPeer = useMemo(() => {
    if (!conversation || conversation.type !== 'direct' || !userId) return null
    const other = conversation.participants.find((p) => p.userId !== userId)
    if (!other?.userId) return null
    return {
      userId: other.userId,
      name: getConversationTitle(conversation, userId),
    }
  }, [conversation, userId])

  const webrtcCall = useWebRtcCall({
    conversationId: selectedId || '',
    // Injected global invite carries peer id before conversation row may load.
    peerUserId: callPeer?.userId ?? injectedInvite?.fromUserId ?? null,
    peerUserName: callPeer?.name ?? injectedInvite?.fromUserName,
    // Keep subscribe path open for injected invites even when callPeer is still null.
    enabled: Boolean(selectedId && (callPeer || injectedInvite)),
    injectedInvite,
    onInjectedInviteConsumed: () => setPendingInvite(null),
  })

  // Publish callBusy so /games layout + game_request widget share the mutex.
  useEffect(() => {
    void setPeerCallBusy(webrtcCall.phase !== 'idle')
    return () => {
      void setPeerCallBusy(false)
    }
  }, [webrtcCall.phase])

  useEffect(() => {
    if (paramC) setSelectedId(paramC)
  }, [paramC])

  const syncConversationUrl = useCallback(
    (id: string | null) => {
      startTransition(() => {
        if (id) {
          router.replace({
            pathname: '/messages',
            query: { c: id },
          } as Parameters<typeof router.replace>[0])
        } else {
          router.replace('/messages')
        }
      })
    },
    [router],
  )

  const selectConversation = useCallback(
    (id: string) => {
      setSelectedId(id)
      setRailOpen(false)
      syncConversationUrl(id)
      // Optimistic zero; thread markAsRead + conversations:inbox fan-out reconcile.
      // Do not refreshInbox() here — races markAsRead and restores a stale unread count.
      clearUnread(id)
    },
    [clearUnread, syncConversationUrl],
  )

  const openDirectConversation = useCallback(
    async (targetUserId: string, displayName?: string) => {
      if (!session?.user?.id) return

      const created = await openOrCreateDirectConversation({
        currentUserId: session.user.id,
        targetUserId,
        displayName,
        conversations,
        createConversation,
      })

      if (created) {
        selectConversation(created.id)
      }
    },
    [session?.user?.id, conversations, createConversation, selectConversation],
  )

  useEffect(() => {
    if (!paramUser || !session?.user?.id) return
    if (deepLinkHandledRef.current === paramUser) return
    if (inbox.loading) return

    deepLinkHandledRef.current = paramUser
    void openDirectConversation(paramUser)
  }, [paramUser, session?.user?.id, inbox.loading, openDirectConversation])

  const onBack = useCallback(() => {
    setSelectedId(null)
    setRailOpen(true)
    syncConversationUrl(null)
  }, [syncConversationUrl])

  const conversationAction = useCallback(
    async (action: string, body: Record<string, unknown> = {}) => {
      if (!selectedId) return
      const response = await apiClient.put(`/api/conversations/${selectedId}`, {
        action,
        ...body,
      })
      if (!response.success) {
        throw new Error(response.error || 'Action failed')
      }
      await refreshInbox()
      return response
    },
    [selectedId, refreshInbox],
  )

  const handleArchive = useCallback(async () => {
    try {
      await conversationAction('archive', { archived: true })
      toast({ title: tMessenger('menuArchive'), description: tMessenger('actionArchiveDone') })
      onBack()
    } catch (err) {
      toast({
        title: tMessenger('actionFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }, [conversationAction, onBack, tMessenger])

  const handleMarkUnread = useCallback(async () => {
    try {
      await conversationAction('mark_unread')
      toast({ title: tMessenger('menuMarkUnread') })
      // Leave thread so MessageThread auto mark-as-read does not undo unread
      onBack()
    } catch (err) {
      toast({
        title: tMessenger('actionFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }, [conversationAction, onBack, tMessenger])

  const handleToggleNotifications = useCallback(async () => {
    const wasMuted = conversation?.metadata?.mutedBy?.includes(userId) ?? false
    try {
      await conversationAction('toggle_notifications')
      toast({
        title: wasMuted
          ? tMessenger('menuEnableNotifications')
          : tMessenger('menuMuteNotifications'),
      })
      await Promise.all([refreshInbox(), refreshConversation()])
    } catch (err) {
      toast({
        title: tMessenger('actionFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }, [
    conversation,
    userId,
    conversationAction,
    refreshInbox,
    refreshConversation,
    tMessenger,
  ])

  const handleDelete = useCallback(async () => {
    if (!selectedId) return
    try {
      const response = await apiClient.delete(`/api/conversations/${selectedId}`)
      if (!response.success) {
        throw new Error(response.error || 'Delete failed')
      }
      toast({ title: tMessenger('menuDelete'), description: tMessenger('actionDeleteDone') })
      onBack()
      await refreshInbox()
    } catch (err) {
      toast({
        title: tMessenger('actionFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }, [selectedId, onBack, refreshInbox, tMessenger])

  const rightRail = useMemo(() => {
    if (!session?.user?.id) return null
    return (
      <MessagesSidebarContent
        userId={session.user.id}
        inbox={inbox}
        selectedConversationId={selectedId}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onConversationSelect={selectConversation}
        onNewConversation={() => setShowNewConv(true)}
      />
    )
  }, [session?.user?.id, inbox, selectedId, searchQuery, selectConversation])

  if (status === 'loading') {
    return (
      <RingRightRailLayout
        rightRailPurpose="messenger"
        showRightRail={false}
        flushCenterPane
        contentClassName="!pb-0"
      >
        <DavinciCenterPane contentClassName="!p-[5px]">
          <div className="flex min-h-[320px] flex-1 items-center justify-center text-muted-foreground">
            {tMessenger('loadingChat')}
          </div>
        </DavinciCenterPane>
      </RingRightRailLayout>
    )
  }

  if (status !== 'authenticated' || !userId) {
    return (
      <RingRightRailLayout
        rightRailPurpose="messenger"
        showRightRail={false}
        flushCenterPane
        contentClassName="!pb-0"
      >
        <DavinciCenterPane contentClassName="!p-[5px]">
          <Card className="flex min-h-[400px] flex-1 flex-col items-center justify-center border-0 bg-transparent p-8 shadow-none">
            <MessageCircle className="mb-4 h-12 w-12 text-muted-foreground" aria-hidden />
            <h2 className="mb-2 text-lg font-semibold">{tMessenger('signInToChat')}</h2>
            <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
              {tMessenger('conversationHint')}
            </p>
            <Button
              onClick={() =>
                void signIn(undefined, { callbackUrl: window.location.href })
              }
            >
              {t('actions.signIn')}
            </Button>
          </Card>
        </DavinciCenterPane>
      </RingRightRailLayout>
    )
  }

  return (
    <RingRightRailLayout
      rightRailPurpose="messenger"
      rightRailContent={[
        { blockType: 'messages-title', i18nKey: 'modules.messenger.title' },
        { blockType: 'messages-search', i18nKey: 'modules.messenger.searchConversationsPlaceholder' },
        { blockType: 'messages-roster' },
      ]}
      rightRail={rightRail}
      railWidth={320}
      flushCenterPane
      contentClassName="!pb-0"
      isOpen={railOpen}
      onToggle={setRailOpen}
      railClassName="min-h-0"
    >
      <DavinciCenterPane
        className="h-[calc(100dvh-5.5rem)] min-h-0"
        contentClassName="flex min-h-0 flex-1 flex-col !p-[5px]"
      >
        <div className="flex min-h-0 flex-1 flex-col">
          {!selectedId && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <MessageCircle className="h-10 w-10 text-muted-foreground/60" aria-hidden />
              <p className="text-sm font-medium text-foreground">
                {tMessenger('selectConversation')}
              </p>
              <p className="max-w-sm text-xs text-muted-foreground">
                {tMessenger('conversationHint')}
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <TunnelIndicatorCompact />
                <span>{tMessenger('realtimeStatus')}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 lg:hidden"
                onClick={() => setRailOpen(true)}
              >
                {tMessenger('title')}
              </Button>
            </div>
          )}

          {selectedId && convLoad && !conversation && (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              {tMessenger('loadingChat')}
            </div>
          )}

          {selectedId && !convLoad && !conversation && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-sm font-medium text-foreground">
                {tMessenger('conversationNotFound')}
              </p>
              <p className="max-w-sm text-xs text-muted-foreground">
                {convError || tMessenger('conversationHint')}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={onBack}>
                {tMessenger('title')}
              </Button>
            </div>
          )}

          {selectedId && conversation && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 items-center p-[5px] md:hidden">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onBack}
                  className="gap-1"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  {tMessenger('title')}
                </Button>
              </div>
              <ConversationHeader
                conversation={conversation}
                currentUserId={userId}
                className="shrink-0"
                onArchiveAction={handleArchive}
                onMarkUnreadAction={handleMarkUnread}
                onToggleNotificationsAction={handleToggleNotifications}
                onDeleteAction={handleDelete}
                onGroupInfoAction={
                  conversation.type === 'group'
                    ? () => setShowGroupMembers(true)
                    : undefined
                }
                onOpenProductAction={
                  conversation.type === 'product' && conversation.metadata?.productId
                    ? () => {
                        // Keep Messages conversation SSOT; deep-link only navigates to product page.
                        // UPGRADE: open in side panel / soft-nav without losing call/thread state.
                        const productId = conversation.metadata!.productId!
                        startTransition(() => {
                          router.push({
                            pathname: '/store/[id]',
                            params: { id: productId },
                          })
                        })
                      }
                    : undefined
                }
                onAudioCallAction={
                  callPeer
                    ? async () => {
                        if (gameBusy) {
                          toast({
                            title: tMessenger('actionFailed'),
                            description: 'Finish your game before starting a call.',
                            variant: 'destructive',
                          })
                          return
                        }
                        const result = await webrtcCall.startCall('audio')
                        if (!result.ok) {
                          toast({
                            title: tMessenger('actionFailed'),
                            description: result.error,
                            variant: 'destructive',
                          })
                        }
                      }
                    : undefined
                }
                onVideoCallAction={
                  callPeer
                    ? async () => {
                        if (gameBusy) {
                          toast({
                            title: tMessenger('actionFailed'),
                            description: 'Finish your game before starting a call.',
                            variant: 'destructive',
                          })
                          return
                        }
                        const result = await webrtcCall.startCall('video')
                        if (!result.ok) {
                          toast({
                            title: tMessenger('actionFailed'),
                            description: result.error,
                            variant: 'destructive',
                          })
                        }
                      }
                    : undefined
                }
              />
              <CallOverlay
                call={webrtcCall}
                peerLabel={callPeer?.name || tMessenger('messageUserFallback')}
              />
              {convError && !fetchedConversation && (
                <p className="shrink-0 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-700 dark:text-amber-300">
                  {convError}
                </p>
              )}
              <MessageThread
                key={selectedId}
                conversationId={selectedId}
                userId={userId}
                conversation={conversation}
                className="min-h-0 flex-1"
                callBusy={webrtcCall.phase !== 'idle'}
              />
            </div>
          )}
        </div>
      </DavinciCenterPane>

      <NewConversationDialog
        open={showNewConv}
        onOpenChangeAction={setShowNewConv}
        createConversation={createConversation}
        conversations={conversations}
        currentUserId={userId}
        onConversationCreatedAction={selectConversation}
        locale={locale}
        excludeUserIds={[userId]}
      />

      {conversation?.type === 'group' && (
        <GroupMembersDialog
          open={showGroupMembers}
          onOpenChangeAction={setShowGroupMembers}
          conversation={conversation}
          currentUserId={userId}
          onUpdatedAction={async () => {
            await Promise.all([refreshInbox(), refreshConversation()])
          }}
        />
      )}
    </RingRightRailLayout>
  )
}
