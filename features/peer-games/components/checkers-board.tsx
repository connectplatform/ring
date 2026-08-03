'use client'

/**
 * Checkers board — click source then destination (dark squares only).
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { GamePluginBoardProps } from '../plugins/types'
import type { CheckersPiece } from '../plugins/checkers-logic'

function label(piece: CheckersPiece): string {
  if (!piece) return ''
  if (piece === 'r') return '●'
  if (piece === 'R') return '♚'
  if (piece === 'b') return '○'
  return '♛'
}

export function CheckersBoard({
  state,
  myUserId,
  turnUserId,
  status,
  disabled,
  onMoveAction,
}: GamePluginBoardProps) {
  const board = (
    Array.isArray(state.board) ? state.board : Array(64).fill(null)
  ) as CheckersPiece[]
  const colors = (state.colors && typeof state.colors === 'object'
    ? state.colors
    : {}) as Record<string, 'r' | 'b'>
  const myColor = colors[myUserId]
  const canPlay =
    status === 'active' && !disabled && Boolean(myColor) && turnUserId === myUserId
  const [selected, setSelected] = useState<number | null>(null)

  return (
    <div
      className="mx-auto grid max-w-md grid-cols-8 gap-0 overflow-hidden rounded-lg border"
      role="grid"
      aria-label="Checkers"
    >
      {board.map((piece, idx) => {
        const r = Math.floor(idx / 8)
        const c = idx % 8
        const dark = (r + c) % 2 === 1
        const isMine =
          piece &&
          myColor &&
          ((myColor === 'r' && (piece === 'r' || piece === 'R')) ||
            (myColor === 'b' && (piece === 'b' || piece === 'B')))
        return (
          <button
            key={idx}
            type="button"
            role="gridcell"
            disabled={!canPlay || !dark}
            className={cn(
              'aspect-square text-lg transition',
              dark ? 'bg-emerald-900/80 text-emerald-50' : 'bg-amber-50',
              selected === idx && 'ring-2 ring-sky-400 ring-inset',
              canPlay && dark && 'hover:brightness-110',
            )}
            onClick={() => {
              if (!canPlay || !dark) return
              if (selected === null) {
                if (isMine) setSelected(idx)
                return
              }
              if (selected === idx) {
                setSelected(null)
                return
              }
              const from = selected
              setSelected(null)
              void onMoveAction({ from, to: idx })
            }}
          >
            {label(piece)}
          </button>
        )
      })}
    </div>
  )
}
