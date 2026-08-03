'use client'

import { useState, useTransition } from 'react'
import { Gamepad2, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import type { GameRequestMetadata, Message } from '@/features/chat/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { acceptGameRequest, declineGameRequest } from '@/app/_actions/peer-games'
import { localizedCatalogTitle } from '@/features/peer-games/lib/catalog-i18n'
import { usePeerCallBusy } from '@/features/peer-games/lib/peer-game-mutex'

function parseGame(message: Message): GameRequestMetadata | null {
  const meta = message.metadata
  if (!meta || meta.kind !== 'game_request') return null
  if (typeof meta.sessionId !== 'string' || typeof meta.slug !== 'string') return null
  return meta as unknown as GameRequestMetadata
}

export interface GameRequestMessageWidgetProps {
  message: Message
  isOwn: boolean
  currentUserId?: string
  className?: string
  /** When true, Accept is blocked (call mutex). Prefer shared usePeerCallBusy. */
  callBusy?: boolean
}

export function GameRequestMessageWidget({
  message,
  isOwn,
  currentUserId,
  className,
  callBusy: callBusyProp,
}: GameRequestMessageWidgetProps) {
  const t = useTranslations('modules.messenger')
  const tGames = useTranslations('modules.games')
  const base = parseGame(message)
  const [local, setLocal] = useState<GameRequestMetadata | null>(null)
  const [pending, startTransition] = useTransition()
  const sharedCallBusy = usePeerCallBusy()
  const callBusy = Boolean(callBusyProp || sharedCallBusy)
  const game = local ?? base

  if (!game) {
    return <div className="whitespace-pre-wrap">{message.content}</div>
  }

  const isPeer = currentUserId === game.peerUserId
  const isPending = game.status === 'pending'
  const openHref = {
    pathname: '/games/[slug]' as const,
    params: { slug: game.slug },
    query: { session: game.sessionId },
  }

  const onAccept = () => {
    if (callBusy) {
      toast({
        title: t('gameCallBusyTitle'),
        description: t('gameCallBusyAccept'),
        variant: 'destructive',
      })
      return
    }
    startTransition(async () => {
      const result = await acceptGameRequest({ sessionId: game.sessionId })
      if (!result.success) {
        toast({ title: result.error ?? t('gameAcceptFailed'), variant: 'destructive' })
        return
      }
      if (result.session) {
        setLocal({
          ...game,
          status: result.session.status,
          winnerUserId: result.session.winnerUserId,
        })
      } else {
        setLocal({ ...game, status: 'active' })
      }
    })
  }

  const onDecline = () => {
    startTransition(async () => {
      const result = await declineGameRequest({ sessionId: game.sessionId })
      if (!result.success) {
        toast({ title: result.error ?? t('gameDeclineFailed'), variant: 'destructive' })
        return
      }
      setLocal({ ...game, status: 'declined' })
    })
  }

  return (
    <div
      className={cn(
        'min-w-[240px] space-y-2 rounded-md border border-border/50 bg-background/40 p-3',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <Gamepad2 className="mt-0.5 h-4 w-4 shrink-0 opacity-80" aria-hidden />
        <div className="space-y-0.5">
          <p className="text-sm font-medium leading-snug">
            {localizedCatalogTitle(tGames, game.slug) || game.title || game.slug}
          </p>
          <p className="text-[11px] opacity-70">
            {t('gameStatus', { status: game.status })}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {isPending && isPeer && !isOwn ? (
          <>
            <Button size="sm" disabled={pending || callBusy} onClick={onAccept}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('gameAccept')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={onDecline}
            >
              {t('gameDecline')}
            </Button>
          </>
        ) : null}
        {(game.status === 'pending' ||
          game.status === 'active' ||
          game.status === 'completed' ||
          game.status === 'resigned') && (
          <Button size="sm" variant="secondary" asChild>
            <Link href={openHref}>{t('gameOpen')}</Link>
          </Button>
        )}
        {isPending && isOwn ? (
          <p className="text-[11px] text-muted-foreground">{t('gameWaitingPeer')}</p>
        ) : null}
      </div>
    </div>
  )
}
