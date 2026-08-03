'use client'

/**
 * Hydrate session from server, then subscribe to game:{sessionId} for deltas.
 * DataChannel carries optimistic hints only — Tunnel/DB remain SSOT.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useSession } from 'next-auth/react'
import { useTunnelChannel } from '@/hooks/use-tunnel-channel'
import type { TunnelMessage } from '@/lib/tunnel/types'
import type { GameMoveTunnelPayload, PeerGameSession } from '../types'
import {
  getPeerGameSessionAction,
  resignPeerGameAction,
  submitPeerGameMoveAction,
} from '@/app/_actions/peer-games'
import { getGameLogic } from '../plugins/registry'
import {
  usePeerGameDataChannel,
  type OptimisticMoveEnvelope,
} from './use-peer-game-datachannel'

export function usePeerGameSession(sessionId: string | null) {
  const { data: session } = useSession()
  const userId = session?.user?.id ?? ''
  const [game, setGame] = useState<PeerGameSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(sessionId))
  const [pending, startTransition] = useTransition()
  const authStateRef = useRef<PeerGameSession | null>(null)

  const hydrate = useCallback(async () => {
    if (!sessionId) {
      setGame(null)
      authStateRef.current = null
      setLoading(false)
      return
    }
    setLoading(true)
    const result = await getPeerGameSessionAction({ sessionId })
    if (!result.success || !result.session) {
      setError(result.error ?? 'Failed to load session')
      setGame(null)
      authStateRef.current = null
    } else {
      setError(null)
      setGame(result.session)
      authStateRef.current = result.session
    }
    setLoading(false)
  }, [sessionId])

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  const applyAuthoritative = useCallback((next: PeerGameSession) => {
    authStateRef.current = next
    setGame(next)
  }, [])

  const onTunnelMessage = useCallback(
    (msg: TunnelMessage) => {
      const event = msg.event
      const payload = msg.payload as GameMoveTunnelPayload | undefined
      if (!payload?.sessionId || payload.sessionId !== sessionId) return

      if (event === 'game:move' || event === 'game:accept' || event === 'game:resign') {
        setGame((prev) => {
          if (!prev) return prev
          const next: PeerGameSession = {
            ...prev,
            state: payload.state ?? prev.state,
            turnUserId:
              payload.turnUserId !== undefined ? payload.turnUserId : prev.turnUserId,
            status: payload.status ?? prev.status,
            winnerUserId:
              payload.winnerUserId !== undefined
                ? payload.winnerUserId
                : prev.winnerUserId,
            moveCount:
              typeof payload.moveCount === 'number' ? payload.moveCount : prev.moveCount,
          }
          authStateRef.current = next
          return next
        })
      }
      if (event === 'game:decline' || event === 'game:expire') {
        const expiredStatus = (msg.payload as { status?: PeerGameSession['status'] } | undefined)
          ?.status
        setGame((prev) => {
          if (!prev) return prev
          const status =
            event === 'game:expire'
              ? expiredStatus ??
                (prev.status === 'pending' ? 'declined' : 'resigned')
              : 'declined'
          const next: PeerGameSession = {
            ...prev,
            status,
            turnUserId: null,
          }
          authStateRef.current = next
          return next
        })
      }
    },
    [sessionId],
  )

  useTunnelChannel({
    channel: sessionId ? `game:${sessionId}` : 'game:none',
    enabled: Boolean(sessionId && userId),
    onTunnelMessage,
  })

  const peerId =
    game?.playerIds.find((id) => id !== userId) ??
    (game
      ? game.challengerUserId === userId
        ? game.peerUserId
        : game.challengerUserId
      : null)

  const onPeerOptimisticMove = useCallback(
    (envelope: OptimisticMoveEnvelope) => {
      if (!sessionId || envelope.sessionId !== sessionId) return
      if (envelope.fromUserId === userId) return
      setGame((prev) => {
        if (!prev || prev.status !== 'active') return prev
        if (envelope.moveSeq <= prev.moveCount) return prev
        const logic = getGameLogic(prev.slug)
        if (!logic) return prev
        try {
          const applied = logic.applyMove({
            state: prev.state,
            move: envelope.pluginPayload,
            byUserId: envelope.fromUserId,
            playerIds: prev.playerIds,
          })
          // Optimistic peer preview only — do not advance authStateRef.
          return {
            ...prev,
            state: applied.state,
            turnUserId: applied.turnUserId,
            status: applied.status,
            winnerUserId: applied.winnerUserId ?? prev.winnerUserId,
            moveCount: Math.max(prev.moveCount, envelope.moveSeq),
          }
        } catch {
          return prev
        }
      })
    },
    [sessionId, userId],
  )

  const { sendOptimisticMove } = usePeerGameDataChannel({
    sessionId,
    selfId: userId,
    peerId: peerId ?? null,
    enabled: Boolean(game?.status === 'active' && userId && peerId),
    onPeerOptimisticMove,
  })

  const submitMove = useCallback(
    (move: Record<string, unknown>) => {
      if (!sessionId) return Promise.resolve()
      return new Promise<void>((resolve, reject) => {
        startTransition(async () => {
          const snapshot = authStateRef.current
          if (snapshot?.status === 'active' && userId) {
            const logic = getGameLogic(snapshot.slug)
            if (logic) {
              const validated = logic.validateMove({
                state: snapshot.state,
                move,
                byUserId: userId,
                playerIds: snapshot.playerIds,
              })
              if (validated.ok) {
                try {
                  const applied = logic.applyMove({
                    state: snapshot.state,
                    move,
                    byUserId: userId,
                    playerIds: snapshot.playerIds,
                  })
                  const optimisticSeq = snapshot.moveCount + 1
                  setGame({
                    ...snapshot,
                    state: applied.state,
                    turnUserId: applied.turnUserId,
                    status: applied.status,
                    winnerUserId: applied.winnerUserId ?? snapshot.winnerUserId,
                    moveCount: optimisticSeq,
                  })
                  sendOptimisticMove(move, optimisticSeq)
                } catch {
                  /* server will decide */
                }
              }
            }
          }

          const result = await submitPeerGameMoveAction({ sessionId, move })
          if (!result.success || !result.session) {
            // Rollback to last authoritative hydrate (or re-fetch).
            if (authStateRef.current) {
              setGame(authStateRef.current)
            } else {
              await hydrate()
            }
            setError(result.error ?? 'Move failed')
            reject(new Error(result.error ?? 'Move failed'))
            return
          }
          applyAuthoritative(result.session)
          setError(null)
          resolve()
        })
      })
    },
    [applyAuthoritative, hydrate, sendOptimisticMove, sessionId, userId],
  )

  const resign = useCallback(() => {
    if (!sessionId) return Promise.resolve()
    return new Promise<void>((resolve, reject) => {
      startTransition(async () => {
        const result = await resignPeerGameAction({ sessionId })
        if (!result.success || !result.session) {
          setError(result.error ?? 'Resign failed')
          reject(new Error(result.error ?? 'Resign failed'))
          return
        }
        applyAuthoritative(result.session)
        resolve()
      })
    })
  }, [applyAuthoritative, sessionId])

  return {
    session: game,
    loading,
    pending,
    error,
    userId,
    submitMove,
    resign,
    refresh: hydrate,
  }
}
