'use client'

/**
 * App-wide incoming call banner — Tunnel + FCM/RFC push emit.
 * Mounted once under CallSessionProvider so offline push rings off /messages.
 */

import { useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { useRouter } from '@/i18n/routing'
import { IncomingCallBanner } from '@/features/chat/components/incoming-call-banner'
import { useCallSession } from '@/features/chat/providers/call-session-provider'
import { usePeerCallBusy, usePeerGameBusy } from '@/features/peer-games/lib/peer-game-mutex'
import { useTunnel } from '@/hooks/use-tunnel'
import { apiClient } from '@/lib/api-client'
import type { IncomingCallInvite } from '@/hooks/use-webrtc-call'

export function GlobalIncomingCallBanner() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { session: callSession, setPendingInvite } = useCallSession()
  const { publish } = useTunnel({ autoConnect: false })
  const gameBusy = usePeerGameBusy()
  const peerCallBusy = usePeerCallBusy()
  const userId = session?.user?.id ?? ''

  const activeConversationId =
    searchParams.get('c') ||
    searchParams.get('conversation') ||
    callSession.conversationId ||
    null
  const callBusy =
    callSession.phase !== 'idle' || gameBusy || peerCallBusy

  const onAccept = useCallback(
    (invite: IncomingCallInvite) => {
      setPendingInvite(invite)
      router.push({
        pathname: '/messages',
        query: { c: invite.conversationId },
      } as Parameters<typeof router.push>[0])
    },
    [router, setPendingInvite],
  )

  const onDecline = useCallback(
    (invite: IncomingCallInvite) => {
      if (!userId) return
      void publish(`conversation:${invite.conversationId}`, 'call:reject', {
        callId: invite.callId,
        fromUserId: userId,
        media: invite.media,
        reason: 'rejected',
      }).catch(() => {})
      void apiClient
        .post(
          `/api/conversations/${invite.conversationId}/call-event`,
          {
            callId: invite.callId,
            event: 'rejected',
            media: invite.media,
          },
          { timeout: 8000, retries: 0 },
        )
        .catch(() => {})
    },
    [publish, userId],
  )

  if (!userId) return null

  return (
    <IncomingCallBanner
      activeConversationId={activeConversationId}
      callBusy={callBusy}
      onAcceptAction={onAccept}
      onDeclineAction={onDecline}
    />
  )
}
