/**
 * Tic-Tac-Toe — pure validate/apply (server-safe, no React).
 */

import type { ApplyMoveResult, ValidateMoveResult } from './types'

export type TicTacToeCell = 'X' | 'O' | null
export type TicTacToeState = {
  board: TicTacToeCell[]
  marks: Record<string, 'X' | 'O'>
}

const WINS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const

function asState(raw: Record<string, unknown>): TicTacToeState | null {
  const board = raw.board
  const marks = raw.marks
  if (!Array.isArray(board) || board.length !== 9) return null
  if (!marks || typeof marks !== 'object') return null
  return {
    board: board.map((c) => (c === 'X' || c === 'O' ? c : null)),
    marks: marks as Record<string, 'X' | 'O'>,
  }
}

function winnerOf(board: TicTacToeCell[]): 'X' | 'O' | null {
  for (const [a, b, c] of WINS) {
    const v = board[a]
    if (v && v === board[b] && v === board[c]) return v
  }
  return null
}

function isDraw(board: TicTacToeCell[]): boolean {
  return board.every((c) => c !== null)
}

export function createTicTacToeInitialState(
  playerIds: [string, string],
): Record<string, unknown> {
  return {
    board: Array(9).fill(null),
    marks: {
      [playerIds[0]]: 'X',
      [playerIds[1]]: 'O',
    },
  } satisfies TicTacToeState
}

export function validateTicTacToeMove(params: {
  state: Record<string, unknown>
  move: Record<string, unknown>
  byUserId: string
  playerIds: string[]
}): ValidateMoveResult {
  const state = asState(params.state)
  if (!state) return { ok: false, error: 'Invalid board state' }
  const mark = state.marks[params.byUserId]
  if (!mark) return { ok: false, error: 'Not a player' }
  if (!params.playerIds.includes(params.byUserId)) {
    return { ok: false, error: 'Not a participant' }
  }
  const cell = Number(params.move.cell)
  if (!Number.isInteger(cell) || cell < 0 || cell > 8) {
    return { ok: false, error: 'Invalid cell' }
  }
  if (state.board[cell] !== null) {
    return { ok: false, error: 'Cell occupied' }
  }
  const xCount = state.board.filter((c) => c === 'X').length
  const oCount = state.board.filter((c) => c === 'O').length
  const expected = xCount === oCount ? 'X' : 'O'
  if (mark !== expected) {
    return { ok: false, error: 'Not your turn' }
  }
  return { ok: true }
}

export function applyTicTacToeMove(params: {
  state: Record<string, unknown>
  move: Record<string, unknown>
  byUserId: string
  playerIds: string[]
}): ApplyMoveResult {
  const validated = validateTicTacToeMove(params)
  if (validated.ok === false) {
    throw new Error(validated.error)
  }
  const state = asState(params.state)!
  const mark = state.marks[params.byUserId]!
  const cell = Number(params.move.cell)
  const board = [...state.board]
  board[cell] = mark

  const winMark = winnerOf(board)
  if (winMark) {
    const winnerUserId =
      Object.entries(state.marks).find(([, m]) => m === winMark)?.[0] ?? null
    return {
      state: { board, marks: state.marks },
      turnUserId: null,
      status: 'completed',
      winnerUserId,
    }
  }
  if (isDraw(board)) {
    return {
      state: { board, marks: state.marks },
      turnUserId: null,
      status: 'completed',
      winnerUserId: null,
    }
  }

  const nextMark = mark === 'X' ? 'O' : 'X'
  const turnUserId =
    Object.entries(state.marks).find(([, m]) => m === nextMark)?.[0] ?? null
  return {
    state: { board, marks: state.marks },
    turnUserId,
    status: 'active',
  }
}
