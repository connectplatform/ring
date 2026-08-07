'use client'

import { cn } from '@/lib/utils'
import type { GamePluginBoardProps } from '../plugins/types'

type Cell = 'X' | 'O' | null

export function TicTacToeBoard({
  state,
  myUserId,
  turnUserId,
  status,
  disabled,
  onMoveAction,
}: GamePluginBoardProps) {
  const board = (Array.isArray(state.board) ? state.board : Array(9).fill(null)) as Cell[]
  const marks = (state.marks && typeof state.marks === 'object'
    ? state.marks
    : {}) as Record<string, 'X' | 'O'>
  const myMark = marks[myUserId]
  const canPlay =
    status === 'active' &&
    !disabled &&
    Boolean(myMark) &&
    turnUserId === myUserId

  return (
    <div className="mx-auto grid max-w-xs grid-cols-3 gap-2" role="grid" aria-label="Tic-Tac-Toe">
      {board.map((cell, idx) => (
        <button
          key={idx}
          type="button"
          role="gridcell"
          disabled={!canPlay || cell !== null}
          className={cn(
            'flex aspect-square items-center justify-center rounded-lg border text-2xl font-semibold transition',
            cell === null && canPlay
              ? 'hover:bg-muted/60 cursor-pointer'
              : 'cursor-default opacity-90',
          )}
          onClick={() => {
            if (!canPlay || cell !== null) return
            void onMoveAction({ cell: idx })
          }}
        >
          {cell ?? ''}
        </button>
      ))}
    </div>
  )
}
