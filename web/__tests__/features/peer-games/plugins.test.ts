/**
 * Unit tests — peer game validate/apply (illegal moves rejected).
 */
import {
  applyTicTacToeMove,
  createTicTacToeInitialState,
  validateTicTacToeMove,
} from '@/features/peer-games/plugins/tic-tac-toe-logic'
import {
  applyChessMove,
  createChessInitialState,
  validateChessMove,
} from '@/features/peer-games/plugins/chess-logic'
import {
  applyCheckersMove,
  createCheckersInitialState,
  validateCheckersMove,
} from '@/features/peer-games/plugins/checkers-logic'

describe('peer-games tic-tac-toe', () => {
  const players: [string, string] = ['u1', 'u2']

  it('rejects occupied cell', () => {
    const state = createTicTacToeInitialState(players)
    const after = applyTicTacToeMove({
      state,
      move: { cell: 0 },
      byUserId: 'u1',
      playerIds: players,
    })
    const bad = validateTicTacToeMove({
      state: after.state,
      move: { cell: 0 },
      byUserId: 'u2',
      playerIds: players,
    })
    expect(bad.ok).toBe(false)
  })

  it('rejects out-of-turn move', () => {
    const state = createTicTacToeInitialState(players)
    const bad = validateTicTacToeMove({
      state,
      move: { cell: 4 },
      byUserId: 'u2',
      playerIds: players,
    })
    expect(bad.ok).toBe(false)
  })

  it('applies legal move and switches turn', () => {
    const state = createTicTacToeInitialState(players)
    const next = applyTicTacToeMove({
      state,
      move: { cell: 4 },
      byUserId: 'u1',
      playerIds: players,
    })
    expect(next.status).toBe('active')
    expect(next.turnUserId).toBe('u2')
    expect((next.state.board as unknown[])[4]).toBe('X')
  })
})

describe('peer-games chess', () => {
  const players: [string, string] = ['white', 'black']

  it('rejects illegal move', () => {
    const state = createChessInitialState(players)
    const bad = validateChessMove({
      state,
      move: { from: 'e2', to: 'e5' },
      byUserId: 'white',
      playerIds: players,
    })
    expect(bad.ok).toBe(false)
  })

  it('rejects black moving first', () => {
    const state = createChessInitialState(players)
    const bad = validateChessMove({
      state,
      move: { from: 'e7', to: 'e5' },
      byUserId: 'black',
      playerIds: players,
    })
    expect(bad.ok).toBe(false)
  })

  it('applies legal pawn move', () => {
    const state = createChessInitialState(players)
    const next = applyChessMove({
      state,
      move: { from: 'e2', to: 'e4' },
      byUserId: 'white',
      playerIds: players,
    })
    expect(next.status).toBe('active')
    expect(next.turnUserId).toBe('black')
    expect(typeof next.state.fen).toBe('string')
  })
})

describe('peer-games checkers', () => {
  const players: [string, string] = ['u1', 'u2']

  it('rejects out-of-turn move', () => {
    const state = createCheckersInitialState(players)
    const bad = validateCheckersMove({
      state,
      move: { from: 17, to: 24 },
      byUserId: 'u2',
      playerIds: players,
    })
    expect(bad.ok).toBe(false)
  })

  it('rejects illegal non-diagonal / light-square landing', () => {
    const state = createCheckersInitialState(players)
    const bad = validateCheckersMove({
      state,
      move: { from: 40, to: 41 },
      byUserId: 'u1',
      playerIds: players,
    })
    expect(bad.ok).toBe(false)
  })

  it('applies legal simple step and switches turn', () => {
    const state = createCheckersInitialState(players)
    // Red piece on row 5 dark square 40 (5,0) can move to 33 (4,1)
    const next = applyCheckersMove({
      state,
      move: { from: 40, to: 33 },
      byUserId: 'u1',
      playerIds: players,
    })
    expect(next.status).toBe('active')
    expect(next.turnUserId).toBe('u2')
    expect((next.state.board as unknown[])[33]).toBe('r')
    expect((next.state.board as unknown[])[40]).toBeNull()
  })
})
