'use client'

import type { ComponentType } from 'react'
import type { PeerGameSlug } from '../types'
import type { GamePluginBoardProps } from '../plugins/types'
import { TicTacToeBoard } from './tic-tac-toe-board'
import { ChessBoard } from './chess-board'
import { CheckersBoard } from './checkers-board'

const BOARDS: Record<PeerGameSlug, ComponentType<GamePluginBoardProps>> = {
  'tic-tac-toe': TicTacToeBoard,
  chess: ChessBoard,
  checkers: CheckersBoard,
}

export function getGameBoard(slug: string): ComponentType<GamePluginBoardProps> | null {
  if (slug in BOARDS) return BOARDS[slug as PeerGameSlug]
  return null
}

export function PeerGameBoard(props: GamePluginBoardProps & { slug: string }) {
  const Board = getGameBoard(props.slug)
  if (!Board) {
    return <p className="text-sm text-muted-foreground">Unknown game.</p>
  }
  return <Board {...props} />
}
