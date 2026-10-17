'use client'

/**
 * Listens on user tunnel channel `calls:incoming` (server fan-out from call-invite).
 * Reuses useTunnelChannel SSOT — same path as notifications:unread.
 * Offline: CALL_INVITE push emit + SW notificationclick → /messages?c=&call=
 * (deep-link consumed by messages-shell GET /api/calls/pending).
 *
 * Lifecycle integrity (2026-09-22):
 * - `call:cancel` (reason='missed' from caller ring-timeout) clears the banner —
 *   user-channel event is always 'update', so the discriminator is payload.reason.
 * - Banner self-timeout at 60s = pending-registry TTL — no infinite ringtone.
 * - Replay: GET /api/calls/pending on mount + tunnel reconnect covers pod-local
 *   queue loss (pod restart) and postgres-fanout live-only mode.
 * - Accept/decline clear the pending key (replay idempotency).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Phone, PhoneOff, Video } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { useTunnel } from '@/hooks/use-tunnel'
import { useTunnelChannel } from '@/hooks/use-tunnel-channel'
import type { IncomingCallInvite } from '@/hooks/use-webrtc-call'
import type { TunnelMessage } from '@/lib/tunnel/types'
import { apiClient } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { startIncomingCallRingtone } from '@/features/chat/lib/call-ringtone'
import { subscribeIncomingCallFromPush } from '@/lib/notifications/incoming-from-push'

const BANNER_RING_TIMEOUT_MS = 60_000

type IncomingCallBannerProps = {
  /** Conversation currently open — ignore duplicate invite for same thread. */
  activeConversationId: string | null
  /** True when local call UI already owns a session. */
  callBusy: boolean
  onAcceptAction: (invite: IncomingCallInvite) => void
  onDeclineAction: (invite: IncomingCallInvite) => void
  className?: string
}

export function IncomingCallBanner({
  activeConversationId,
  callBusy,
  onAcceptAction,
  onDeclineAction,
  className,
}: IncomingCallBannerProps) {
  const t = useTranslations('modules.messenger')
  const { data: session } = useSession()
  const [invite, setInvite] = useState<IncomingCallInvite | null>(null)

  // Props arrive async (search params resolve late) — refs keep guards fresh.
  const callBusyRef = useRef(callBusy)
  const activeConversationIdRef = useRef(activeConversationId)
  callBusyRef.current = callBusy
  activeConversationIdRef.current = activeConversationId

  const canShowInvite = useCallback(
    (payload: IncomingCallInvite): boolean => {
      if (!payload?.callId || !payload.conversationId || !payload.fromUserId) return false
      if (payload.fromUserId === session?.user?.id) return false
      // Conversation-channel handler covers the open thread; skip duplicate banner.
      if (payload.conversationId === activeConversationIdRef.current) return false
      return true
    },
    [session?.user?.id],
  )

  const onTunnelMessage = useCallback(
    (msg: TunnelMessage) => {
      if (callBusyRef.current) return
      const payload = msg.payload as IncomingCallInvite | undefined
      if (!payload?.callId) return
      // call:cancel from caller ring-timeout (user-channel event is always
      // 'update' — the reason field is the discriminator).
      if (payload.reason === 'missed') {
        setInvite((prev) => (prev?.callId === payload.callId ? null : prev))
        return
      }
      if (!canShowInvite(payload)) return
      setInvite((prev) => (prev?.callId === payload.callId ? prev : payload))
    },
    [canShowInvite],
  )

  useTunnelChannel({
    channel: 'calls:incoming',
    enabled: Boolean(session?.user?.id),
    onTunnelMessage,
  })

  // Replay — pending-invite registry read on mount and on tunnel (re)connect.
  const { isConnected } = useTunnel({ autoConnect: false })
  const fetchPendingInvite = useCallback(async () => {
    if (callBusyRef.current) return
    const res = await apiClient.get('/api/calls/pending').catch(() => null)
    if (!res?.success) return
    const pending = (res.data as { invite?: IncomingCallInvite } | undefined)?.invite
    if (!pending || !canShowInvite(pending)) return
    setInvite((prev) => (prev?.callId === pending.callId ? prev : pending))
  }, [canShowInvite])

  useEffect(() => {
    void fetchPendingInvite()
  }, [fetchPendingInvite])

  useEffect(() => {
    if (!isConnected) return
    void fetchPendingInvite()
  }, [isConnected, fetchPendingInvite])

  // SW push (FCM onMessage, focused tab) — cross-check against the pending
  // registry so pushes from long-dead calls never resurrect a banner.
  useEffect(() => {
    return subscribeIncomingCallFromPush((payload) => {
      if (callBusyRef.current) return
      if (!canShowInvite(payload)) return
      void (async () => {
        const res = await apiClient.get('/api/calls/pending').catch(() => null)
        if (!res?.success) return
        const pending = (res.data as { invite?: IncomingCallInvite } | undefined)
          ?.invite
        if (!pending || pending.callId !== payload.callId) return
        setInvite((prev) => (prev?.callId === payload.callId ? prev : payload))
      })()
    })
  }, [canShowInvite])

  // Ringtone + banner self-timeout (pending-registry TTL twin).
  useEffect(() => {
    if (!invite) return
    const stopRingtone = startIncomingCallRingtone()
    const timeoutId = window.setTimeout(() => {
      setInvite((prev) => (prev?.callId === invite.callId ? null : prev))
    }, BANNER_RING_TIMEOUT_MS)
    return () => {
      stopRingtone()
      window.clearTimeout(timeoutId)
    }
  }, [invite])

  if (!invite) return null

  return (
    <div
      className={cn(
        'fixed inset-x-0 top-16 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur',
        className,
      )}
      role="alertdialog"
      aria-label={t('callIncoming')}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600/15 text-emerald-600">
        {invite.media === 'video' ? (
          <Video className="h-5 w-5" aria-hidden />
        ) : (
          <Phone className="h-5 w-5" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {invite.fromUserName || t('callIncoming')}
        </p>
        <p className="text-xs text-muted-foreground">{t('callIncoming')}</p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        className="h-9 w-9 rounded-full p-0"
        aria-label={t('callReject')}
        onClick={() => {
          void apiClient.post('/api/calls/pending', { callId: invite.callId }).catch(() => {})
          onDeclineAction(invite)
          setInvite(null)
        }}
      >
        <PhoneOff className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="sm"
        className="h-9 w-9 rounded-full bg-emerald-600 p-0 hover:bg-emerald-500"
        aria-label={t('callAccept')}
        onClick={() => {
          void apiClient.post('/api/calls/pending', { callId: invite.callId }).catch(() => {})
          onAcceptAction(invite)
          setInvite(null)
        }}
      >
        <Phone className="h-4 w-4" />
      </Button>
    </div>
  )
}
