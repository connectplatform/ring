'use client'

/**
 * Listens on user tunnel channel `calls:incoming` (server fan-out from call-invite).
 * Reuses useTunnelChannel SSOT — same path as notifications:unread.
 *
 * UPGRADE: play ringtone via Web Audio; integrate FCM when Tunnel offline.
 * UPGRADE: CallKit / ConnectionService on native wrappers.
 */

import { useCallback, useState } from 'react'
import { Phone, PhoneOff, Video } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { useTunnelChannel } from '@/hooks/use-tunnel-channel'
import type { IncomingCallInvite } from '@/hooks/use-webrtc-call'
import type { TunnelMessage } from '@/lib/tunnel/types'
import { cn } from '@/lib/utils'

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

  const onTunnelMessage = useCallback(
    (msg: TunnelMessage) => {
      if (callBusy) return
      const payload = msg.payload as IncomingCallInvite | undefined
      if (!payload?.callId || !payload.conversationId || !payload.fromUserId) return
      if (payload.fromUserId === session?.user?.id) return
      // Conversation-channel handler covers the open thread; skip duplicate banner.
      if (payload.conversationId === activeConversationId) return
      setInvite(payload)
    },
    [activeConversationId, callBusy, session?.user?.id],
  )

  useTunnelChannel({
    channel: 'calls:incoming',
    enabled: Boolean(session?.user?.id),
    onTunnelMessage,
  })

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
          onAcceptAction(invite)
          setInvite(null)
        }}
      >
        <Phone className="h-4 w-4" />
      </Button>
    </div>
  )
}
