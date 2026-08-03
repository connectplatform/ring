/**
 * American / English draughts (checkers) — pure validate/apply (server-safe).
 * Single jump per turn; forced capture when any capture exists.
 * UPGRADE: multi-jump chains, flying kings (international), sea-battle/bingo titles.
 */

import type { ApplyMoveResult, ValidateMoveResult } from './types'

export type CheckersPiece = 'r' | 'R' | 'b' | 'B' | null
export type CheckersState = {
  /** 64 cells; light squares always null. Dark playable. */
  board: CheckersPiece[]
  /** seat0 → red (r/R), seat1 → black (b/B) */
  colors: Record<string, 'r' | 'b'>
  /** Whose turn: red moves first (challenger / seat0). */
  turnColor: 'r' | 'b'
}

const DIRS_FORWARD: Record<'r' | 'b', [number, number][]> = {
  // red moves toward row 0
  r: [
    [-1, -1],
    [-1, 1],
  ],
  // black moves toward row 7
  b: [
    [1, -1],
    [1, 1],
  ],
}

const DIRS_KING: [number, number][] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
]

function isDark(idx: number): boolean {
  const r = Math.floor(idx / 8)
  const c = idx % 8
  return (r + c) % 2 === 1
}

function asState(raw: Record<string, unknown>): CheckersState | null {
  const board = raw.board
  const colors = raw.colors
  const turnColor = raw.turnColor === 'b' ? 'b' : 'r'
  if (!Array.isArray(board) || board.length !== 64) return null
  if (!colors || typeof colors !== 'object') return null
  return {
    board: board.map((p) =>
      p === 'r' || p === 'R' || p === 'b' || p === 'B' ? p : null,
    ),
    colors: colors as Record<string, 'r' | 'b'>,
    turnColor,
  }
}

function colorOf(piece: CheckersPiece): 'r' | 'b' | null {
  if (!piece) return null
  return piece === 'r' || piece === 'R' ? 'r' : 'b'
}

function isKing(piece: CheckersPiece): boolean {
  return piece === 'R' || piece === 'B'
}

function dirsFor(piece: CheckersPiece): [number, number][] {
  if (!piece) return []
  if (isKing(piece)) return DIRS_KING
  return DIRS_FORWARD[colorOf(piece)!]
}

function at(board: CheckersPiece[], r: number, c: number): CheckersPiece | undefined {
  if (r < 0 || r > 7 || c < 0 || c > 7) return undefined
  return board[r * 8 + c]
}

function listMoves(
  state: CheckersState,
  byUserId: string,
): { from: number; to: number; capture?: number }[] {
  const myColor = state.colors[byUserId]
  if (!myColor) return []
  const simple: { from: number; to: number; capture?: number }[] = []
  const captures: { from: number; to: number; capture?: number }[] = []

  for (let from = 0; from < 64; from++) {
    const piece = state.board[from]
    if (!piece || colorOf(piece) !== myColor) continue
    const r = Math.floor(from / 8)
    const c = from % 8
    for (const [dr, dc] of dirsFor(piece)) {
      const nr = r + dr
      const nc = c + dc
      const step = at(state.board, nr, nc)
      if (step === null && isDark(nr * 8 + nc)) {
        simple.push({ from, to: nr * 8 + nc })
        continue
      }
      if (step && colorOf(step) && colorOf(step) !== myColor) {
        const lr = nr + dr
        const lc = nc + dc
        const land = at(state.board, lr, lc)
        if (land === null && isDark(lr * 8 + lc)) {
          captures.push({ from, to: lr * 8 + lc, capture: nr * 8 + nc })
        }
      }
    }
  }
  return captures.length > 0 ? captures : simple
}

function hasAnyPieces(board: CheckersPiece[], color: 'r' | 'b'): boolean {
  return board.some((p) => colorOf(p) === color)
}

function promote(piece: CheckersPiece, to: number): CheckersPiece {
  if (!piece) return piece
  const r = Math.floor(to / 8)
  if (piece === 'r' && r === 0) return 'R'
  if (piece === 'b' && r === 7) return 'B'
  return piece
}

export function createCheckersInitialState(
  playerIds: [string, string],
): Record<string, unknown> {
  const board: CheckersPiece[] = Array(64).fill(null)
  for (let i = 0; i < 64; i++) {
    if (!isDark(i)) continue
    const r = Math.floor(i / 8)
    if (r <= 2) board[i] = 'b'
    if (r >= 5) board[i] = 'r'
  }
  return {
    board,
    colors: {
      [playerIds[0]]: 'r',
      [playerIds[1]]: 'b',
    },
    turnColor: 'r',
  } satisfies CheckersState
}

export function validateCheckersMove(params: {
  state: Record<string, unknown>
  move: Record<string, unknown>
  byUserId: string
  playerIds: string[]
}): ValidateMoveResult {
  const state = asState(params.state)
  if (!state) return { ok: false, error: 'Invalid board state' }
  if (!params.playerIds.includes(params.byUserId)) {
    return { ok: false, error: 'Not a participant' }
  }
  if (!state.colors[params.byUserId]) {
    return { ok: false, error: 'Not a player' }
  }
  if (state.colors[params.byUserId] !== state.turnColor) {
    return { ok: false, error: 'Not your turn' }
  }
  const from = Number(params.move.from)
  const to = Number(params.move.to)
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from > 63 || to < 0 || to > 63) {
    return { ok: false, error: 'Invalid squares' }
  }
  const legal = listMoves(state, params.byUserId)
  if (!legal.some((m) => m.from === from && m.to === to)) {
    return { ok: false, error: 'Illegal move' }
  }
  return { ok: true }
}

export function applyCheckersMove(params: {
  state: Record<string, unknown>
  move: Record<string, unknown>
  byUserId: string
  playerIds: string[]
}): ApplyMoveResult {
  const validated = validateCheckersMove(params)
  if (validated.ok === false) {
    throw new Error(validated.error)
  }
  const state = asState(params.state)!
  const from = Number(params.move.from)
  const to = Number(params.move.to)
  const match = listMoves(state, params.byUserId).find(
    (m) => m.from === from && m.to === to,
  )!
  const board = [...state.board]
  let piece = board[from]
  board[from] = null
  if (typeof match.capture === 'number') {
    board[match.capture] = null
  }
  piece = promote(piece, to)
  board[to] = piece

  const myColor = state.colors[params.byUserId]!
  const oppColor = myColor === 'r' ? 'b' : 'r'
  const oppUserId =
    Object.entries(state.colors).find(([, c]) => c === oppColor)?.[0] ?? null

  if (!hasAnyPieces(board, oppColor)) {
    return {
      state: { board, colors: state.colors, turnColor: oppColor },
      turnUserId: null,
      status: 'completed',
      winnerUserId: params.byUserId,
    }
  }

  const nextState: CheckersState = {
    board,
    colors: state.colors,
    turnColor: oppColor,
  }
  const oppMoves = listMoves(nextState, oppUserId || '')
  if (oppUserId && oppMoves.length === 0) {
    return {
      state: nextState,
      turnUserId: null,
      status: 'completed',
      winnerUserId: params.byUserId,
    }
  }

  return {
    state: nextState,
    turnUserId: oppUserId,
    status: 'active',
  }
}
