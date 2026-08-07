/**
 * GamePlugin contract — validate/apply on server; Component is client-only.
 */

import type { ComponentType } from 'react'
import type { PeerGameSlug } from '../types'

export type GamePluginBoardProps = {
  sessionId: string
  state: Record<string, unknown>
  myUserId: string
  turnUserId: string | null
  playerIds: string[]
  status: string
  disabled?: boolean
  onMoveAction: (payload: Record<string, unknown>) => Promise<void> | void
}

export type ValidateMoveResult =
  | { ok: true }
  | { ok: false; error: string }

export type ApplyMoveResult = {
  state: Record<string, unknown>
  /** Next turn; null when game over. */
  turnUserId: string | null
  status: 'active' | 'completed'
  winnerUserId?: string | null
}

export type GamePlugin = {
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
  /** Client board — dynamic-imported where heavy (chess). */
  Component: ComponentType<GamePluginBoardProps>
}
