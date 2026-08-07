/**
 * Chess — pure validate/apply via chess.js (server-safe).
 * Board UI lives in components/chess-board.tsx (dynamic import react-chessboard).
 */

import { Chess, type Square } from 'chess.js'
import type { ApplyMoveResult, ValidateMoveResult } from './types'

export type ChessState = {
  fen: string
  colors: Record<string, 'w' | 'b'>
  /** SAN history for audit. */
  history: string[]
}

function asState(raw: Record<string, unknown>): ChessState | null {
  if (typeof raw.fen !== 'string' || !raw.fen) return null
  if (!raw.colors || typeof raw.colors !== 'object') return null
  const history = Array.isArray(raw.history)
    ? raw.history.filter((h): h is string => typeof h === 'string')
    : []
  return {
    fen: raw.fen,
    colors: raw.colors as Record<string, 'w' | 'b'>,
    history,
  }
}

export function createChessInitialState(
  playerIds: [string, string],
): Record<string, unknown> {
  const game = new Chess()
  return {
    fen: game.fen(),
    colors: {
      [playerIds[0]]: 'w',
      [playerIds[1]]: 'b',
    },
    history: [],
  } satisfies ChessState
}

export function validateChessMove(params: {
  state: Record<string, unknown>
  move: Record<string, unknown>
  byUserId: string
  playerIds: string[]
}): ValidateMoveResult {
  const state = asState(params.state)
  if (!state) return { ok: false, error: 'Invalid chess state' }
  if (!params.playerIds.includes(params.byUserId)) {
    return { ok: false, error: 'Not a participant' }
  }
  const color = state.colors[params.byUserId]
  if (!color) return { ok: false, error: 'Not a player' }

  let game: Chess
  try {
    game = new Chess(state.fen)
  } catch {
    return { ok: false, error: 'Corrupt FEN' }
  }
  if (game.isGameOver()) return { ok: false, error: 'Game over' }
  if (game.turn() !== color) return { ok: false, error: 'Not your turn' }

  const from = String(params.move.from || '')
  const to = String(params.move.to || '')
  if (!from || !to) return { ok: false, error: 'from/to required' }

  const promotion =
    typeof params.move.promotion === 'string' ? params.move.promotion : undefined

  try {
    const probe = game.move({
      from: from as Square,
      to: to as Square,
      promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined,
    })
    if (!probe) return { ok: false, error: 'Illegal move' }
  } catch {
    return { ok: false, error: 'Illegal move' }
  }
  return { ok: true }
}

export function applyChessMove(params: {
  state: Record<string, unknown>
  move: Record<string, unknown>
  byUserId: string
  playerIds: string[]
}): ApplyMoveResult {
  const validated = validateChessMove(params)
  if (validated.ok === false) throw new Error(validated.error)

  const state = asState(params.state)!
  const game = new Chess(state.fen)
  const from = String(params.move.from)
  const to = String(params.move.to)
  const promotion =
    typeof params.move.promotion === 'string' ? params.move.promotion : undefined

  let result
  try {
    result = game.move({
      from: from as Square,
      to: to as Square,
      promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined,
    })
  } catch {
    throw new Error('Illegal move')
  }
  if (!result) throw new Error('Illegal move')

  const next: ChessState = {
    fen: game.fen(),
    colors: state.colors,
    history: [...state.history, result.san],
  }

  if (game.isCheckmate()) {
    return {
      state: next,
      turnUserId: null,
      status: 'completed',
      winnerUserId: params.byUserId,
    }
  }
  if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition()) {
    return {
      state: next,
      turnUserId: null,
      status: 'completed',
      winnerUserId: null,
    }
  }

  const nextColor = game.turn()
  const turnUserId =
    Object.entries(state.colors).find(([, c]) => c === nextColor)?.[0] ?? null
  return {
    state: next,
    turnUserId,
    status: 'active',
  }
}
