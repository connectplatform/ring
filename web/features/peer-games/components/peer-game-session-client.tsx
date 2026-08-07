'use client'

/**
 * Mini-app shell — hydrate then Tunnel deltas + DataChannel optimistic hints.
 * Telegram WebApp BackButton → /games when present.
 */

import { useEffect } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PeerGameBoard } from './peer-game-board'
import { usePeerGameSession } from '../hooks/use-peer-game-session'
import { useTelegramGamesBackButton } from '../hooks/use-telegram-games-back-button'
import { setPeerGameBusy } from '../lib/peer-game-mutex'
import { ROUTES } from '@/constants/routes'
import { toast } from '@/hooks/use-toast'

export function PeerGameSessionClient({
  slug,
  sessionId,
}: {
  slug: string
  sessionId: string | null
}) {
  const { session, loading, pending, error, userId, submitMove, resign } =
    usePeerGameSession(sessionId)

  useTelegramGamesBackButton(Boolean(sessionId))

  useEffect(() => {
    const active = session?.status === 'active' || session?.status === 'pending'
    void setPeerGameBusy(Boolean(active && sessionId))
    return () => {
      void setPeerGameBusy(false)
    }
  }, [session?.status, sessionId])

  if (!sessionId) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center space-y-3">
        <p className="text-muted-foreground">
          Open a challenge from Messages or a member&apos;s public games page to start a
          session.
        </p>
        <Button asChild variant="outline">
          <Link href={ROUTES.GAMES()}>Back to catalog</Link>
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading session…
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center space-y-3">
        <p className="text-destructive">{error || 'Session not found'}</p>
        <Button asChild variant="outline">
          <Link href={ROUTES.GAMES()}>Back to catalog</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-muted-foreground capitalize">
          Status: {session.status}
          {session.turnUserId === userId ? ' · Your turn' : ''}
          {session.winnerUserId
            ? session.winnerUserId === userId
              ? ' · You won'
              : ' · Opponent won'
            : ''}
        </p>
        {(session.status === 'active' || session.status === 'pending') && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              void resign().catch((err) => {
                toast({
                  title: err instanceof Error ? err.message : 'Resign failed',
                  variant: 'destructive',
                })
              })
            }}
          >
            Resign
          </Button>
        )}
      </div>

      <PeerGameBoard
        slug={slug}
        sessionId={session.id}
        state={session.state}
        myUserId={userId}
        turnUserId={session.turnUserId}
        playerIds={session.playerIds}
        status={session.status}
        disabled={pending || session.status !== 'active'}
        onMoveAction={async (payload) => {
          try {
            await submitMove(payload)
          } catch (err) {
            toast({
              title: err instanceof Error ? err.message : 'Illegal move',
              variant: 'destructive',
            })
          }
        }}
      />
    </div>
  )
}
