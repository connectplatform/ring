'use client'

/**
 * Chess board — dynamic-import chess.js + react-chessboard (client only).
 * No optimistic apply: return false from drop; FEN prop is SSOT after server ack.
 * UPGRADE P1: RTCDataChannel for optimistic local preview; server remains SSOT.
 */

import { useCallback, useEffect, useState } from 'react'
import type { GamePluginBoardProps } from '../plugins/types'

type ChessJs = typeof import('chess.js')
type ChessboardMod = typeof import('react-chessboard')

export function ChessBoard({
  state,
  myUserId,
  turnUserId,
  status,
  disabled,
  onMoveAction,
}: GamePluginBoardProps) {
  const [Chess, setChess] = useState<ChessJs['Chess'] | null>(null)
  const [Chessboard, setChessboard] = useState<ChessboardMod['Chessboard'] | null>(
    null,
  )
  const fen = typeof state.fen === 'string' ? state.fen : 'start'
  const colors = (state.colors && typeof state.colors === 'object'
    ? state.colors
    : {}) as Record<string, 'w' | 'b'>
  const myColor = colors[myUserId]
  const canPlay =
    status === 'active' &&
    !disabled &&
    Boolean(myColor) &&
    turnUserId === myUserId

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [chessMod, boardMod] = await Promise.all([
        import('chess.js'),
        import('react-chessboard'),
      ])
      if (cancelled) return
      setChess(() => chessMod.Chess)
      setChessboard(() => boardMod.Chessboard)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const onPieceDrop = useCallback(
    ({
      sourceSquare,
      targetSquare,
    }: {
      sourceSquare: string
      targetSquare: string | null
    }) => {
      if (!canPlay || !Chess || !targetSquare) return false
      try {
        const game = new Chess(fen)
        const move = game.move({
          from: sourceSquare as never,
          to: targetSquare as never,
          promotion: 'q',
        })
        if (!move) return false
        // Return false so the board snaps to `position` (fen) until server ack updates it.
        void onMoveAction({
          from: sourceSquare,
          to: targetSquare,
          promotion: move.promotion || undefined,
        })
        return false
      } catch {
        return false
      }
    },
    [Chess, canPlay, fen, onMoveAction],
  )

  if (!Chessboard) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading chessboard…
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <Chessboard
        key={fen}
        options={{
          position: fen,
          allowDragging: canPlay,
          boardOrientation: myColor === 'b' ? 'black' : 'white',
          onPieceDrop,
        }}
      />
    </div>
  )
}
