/**
 * Server-safe plugin logic registry (no React / chessboard).
 */

import type { PeerGameSlug } from '../types'
import type { ApplyMoveResult, ValidateMoveResult } from './types'
import {
  applyTicTacToeMove,
  createTicTacToeInitialState,
  validateTicTacToeMove,
} from './tic-tac-toe-logic'
import {
  applyChessMove,
  createChessInitialState,
  validateChessMove,
} from './chess-logic'
import {
  applyCheckersMove,
  createCheckersInitialState,
  validateCheckersMove,
} from './checkers-logic'

export type GameLogicPlugin = {
  slug: PeerGameSlug
  minPlayers: number
  maxPlayers: number
  initialState: (playerIds: [string, string]) => Record<string, unknown>
  validateMove: (params: {
    state: Record<string, unknown>
    move: Record<string, unknown>
    byUserId: string
    playerIds: string[]
  }) => ValidateMoveResult
  applyMove: (params: {
    state: Record<string, unknown>
    move: Record<string, unknown>
    byUserId: string
    playerIds: string[]
  }) => ApplyMoveResult
}

const LOGIC: Record<PeerGameSlug, GameLogicPlugin> = {
  'tic-tac-toe': {
    slug: 'tic-tac-toe',
    minPlayers: 2,
    maxPlayers: 2,
    initialState: createTicTacToeInitialState,
    validateMove: validateTicTacToeMove,
    applyMove: applyTicTacToeMove,
  },
  chess: {
    slug: 'chess',
    minPlayers: 2,
    maxPlayers: 2,
    initialState: createChessInitialState,
    validateMove: validateChessMove,
    applyMove: applyChessMove,
  },
  checkers: {
    slug: 'checkers',
    minPlayers: 2,
    maxPlayers: 2,
    initialState: createCheckersInitialState,
    validateMove: validateCheckersMove,
    applyMove: applyCheckersMove,
  },
}

export function getGameLogic(slug: string): GameLogicPlugin | null {
  if (slug in LOGIC) return LOGIC[slug as PeerGameSlug]
  return null
}
