'use client'

/**
 * Listens on user tunnel channel `games:incoming` (server fan-out from createInvite).
 * Mount once under TunnelProvider (GlobalTunnelListeners) so challenges ring off /messages.
 * Clears on game:expire / game:decline via game:{sessionId} (same channels expiry uses).
 */

import { useCallback, useEffect, useState } from 'react'
import { Gamepad2, X } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { useTunnelChannel } from '@/hooks/use-tunnel-channel'
import type { IncomingGameInvite } from '@/features/peer-games/types'
import { acceptGameRequest, declineGameRequest } from '@/app/_actions/peer-games'
import { localizedCatalogTitle } from '@/features/peer-games/lib/catalog-i18n'
import { usePeerCallBusy } from '@/features/peer-games/lib/peer-game-mutex'
import { playGameInviteChime } from '@/features/peer-games/lib/game-invite-chime'
import type { TunnelMessage } from '@/lib/tunnel/types'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { subscribeIncomingGameFromPush } from '@/lib/notifications/incoming-from-push'

type IncomingGameBannerProps = {
  /** When true (WebRTC call busy), ignore incoming game invites. */
  callBusy?: boolean
  /** When true (local game already active), ignore new invites. */
  gameBusy?: boolean
  onAcceptedAction?: (invite: IncomingGameInvite) => void
  className?: string
}

export function IncomingGameBanner({
  callBusy: callBusyProp,
  gameBusy = false,
  onAcceptedAction,
  className,
}: IncomingGameBannerProps) {
  const t = useTranslations('modules.messenger')
  const tGames = useTranslations('modules.games')
  const { data: session } = useSession()
  const router = useRouter()
  const sharedCallBusy = usePeerCallBusy()
  const callBusy = Boolean(callBusyProp || sharedCallBusy)
  const [invite, setInvite] = useState<IncomingGameInvite | null>(null)
  const [busy, setBusy] = useState(false)

  const onTunnelMessage = useCallback(
    (msg: TunnelMessage) => {
      if (callBusy || gameBusy) return
      const payload = msg.payload as IncomingGameInvite & {
        accepted?: boolean
        terminal?: boolean
      }
      if (!payload?.sessionId) return
      // Terminal / accepted on games:incoming — clear matching banner (subscribe race cover).
      if (payload.terminal || payload.accepted) {
        setInvite((prev) => (prev?.sessionId === payload.sessionId ? null : prev))
        return
      }
      if (!payload.conversationId || !payload.fromUserId) return
      if (payload.fromUserId === session?.user?.id) return
      setInvite((prev) => (prev?.sessionId === payload.sessionId ? prev : payload))
    },
    [callBusy, gameBusy, session?.user?.id],
  )

  useTunnelChannel({
    channel: 'games:incoming',
    enabled: Boolean(session?.user?.id),
    onTunnelMessage,
  })

  useEffect(() => {
    return subscribeIncomingGameFromPush((payload) => {
      if (callBusy || gameBusy) return
      if (!payload?.sessionId || !payload.conversationId || !payload.fromUserId) return
      if (payload.fromUserId === session?.user?.id) return
      setInvite((prev) => (prev?.sessionId === payload.sessionId ? prev : payload))
    })
  }, [callBusy, gameBusy, session?.user?.id])

  const onSessionLifecycle = useCallback(
    (msg: TunnelMessage) => {
      // Accept from chat widget (or peer) must clear banner too — not only expire/decline.
      if (
        msg.event !== 'game:expire' &&
        msg.event !== 'game:decline' &&
        msg.event !== 'game:accept'
      ) {
        return
      }
      const sid = (msg.payload as { sessionId?: string } | undefined)?.sessionId
      if (!sid || !invite || sid !== invite.sessionId) return
      setInvite(null)
    },
    [invite],
  )

  useTunnelChannel({
    channel: invite ? `game:${invite.sessionId}` : 'game:none',
    enabled: Boolean(invite?.sessionId && session?.user?.id),
    onTunnelMessage: onSessionLifecycle,
  })

  useEffect(() => {
    if (!invite) return
    playGameInviteChime()
  }, [invite])

  if (!invite) return null

  const title = localizedCatalogTitle(tGames, invite.slug)

  const onDecline = async () => {
    setBusy(true)
    try {
      await declineGameRequest({ sessionId: invite.sessionId })
    } catch {
      /* ignore */
    }
    setInvite(null)
    setBusy(false)
  }

  const onAccept = async () => {
    if (callBusy) {
      toast({
        title: t('gameCallBusyTitle'),
        description: t('gameCallBusyAccept'),
        variant: 'destructive',
      })
      return
    }
    setBusy(true)
    const result = await acceptGameRequest({ sessionId: invite.sessionId })
    setBusy(false)
    if (!result.success) {
      toast({ title: result.error ?? t('gameAcceptFailed'), variant: 'destructive' })
      return
    }
    const accepted = invite
    setInvite(null)
    onAcceptedAction?.(accepted)
    router.push({
      pathname: '/games/[slug]',
      params: { slug: accepted.slug },
      query: { session: accepted.sessionId },
    })
  }

  return (
    <div
      className={cn(
        'fixed inset-x-0 top-16 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur',
        className,
      )}
      role="alertdialog"
      aria-label={t('gameIncoming')}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-600/15 text-sky-600">
        <Gamepad2 className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {invite.fromUserName || t('gameIncoming')} — {title}
        </p>
        <p className="text-xs text-muted-foreground">{t('gameIncoming')}</p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        className="h-9 w-9 rounded-full p-0"
        aria-label={t('gameDecline')}
        disabled={busy}
        onClick={() => void onDecline()}
      >
        <X className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="sm"
        className="h-9 rounded-full bg-sky-600 px-3 hover:bg-sky-500"
        aria-label={t('gameAccept')}
        disabled={busy}
        onClick={() => void onAccept()}
      >
        {t('gameAccept')}
      </Button>
    </div>
  )
}
