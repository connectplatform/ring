/**
 * Peer Games — session / move / availability types (P0).
 * Tunnel deltas patch these; DB row remains SSOT.
 */

import { z } from 'zod'

export const PEER_GAME_SLUGS = ['tic-tac-toe', 'chess', 'checkers'] as const
export type PeerGameSlug = (typeof PEER_GAME_SLUGS)[number]

export const peerGameSlugSchema = z.enum(PEER_GAME_SLUGS)

export const peerGameSessionStatusSchema = z.enum([
  'pending',
  'active',
  'completed',
  'declined',
  'resigned',
])
export type PeerGameSessionStatus = z.infer<typeof peerGameSessionStatusSchema>

export const peerGameMoveSchema = z.object({
  /** Opaque plugin-specific payload (e.g. { row, col } or { from, to, promotion }). */
  payload: z.record(z.string(), z.unknown()),
  /** Client-supplied idempotency hint (optional). */
  clientMoveId: z.string().min(1).max(64).optional(),
})
export type PeerGameMove = z.infer<typeof peerGameMoveSchema>

export const peerGameSessionSchema = z.object({
  id: z.string().min(1),
  slug: peerGameSlugSchema,
  status: peerGameSessionStatusSchema,
  conversationId: z.string().min(1),
  messageId: z.string().optional(),
  challengerUserId: z.string().min(1),
  peerUserId: z.string().min(1),
  /** Seat order: index 0 = X / white, index 1 = O / black. */
  playerIds: z.array(z.string()).min(2).max(2),
  turnUserId: z.string().nullable(),
  winnerUserId: z.string().nullable().optional(),
  state: z.record(z.string(), z.unknown()),
  moveCount: z.number().int().nonnegative().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
})
export type PeerGameSession = z.infer<typeof peerGameSessionSchema>

/** Chat interactive metadata for type `game_request` — SSOT lives in chat types. */
export type { GameRequestMetadata } from '@/features/chat/types'

export const userPeerGamesSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  username: z.string().optional(),
  /** Public visibility — profile `/{username}/games` lists these. */
  visibility: z.enum(['public']).default('public'),
  enabledSlugs: z.array(peerGameSlugSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type UserPeerGames = z.infer<typeof userPeerGamesSchema>

export type IncomingGameInvite = {
  sessionId: string
  slug: PeerGameSlug
  conversationId: string
  messageId?: string
  fromUserId: string
  fromUserName?: string
  peerUserId: string
}

export type GameMoveTunnelPayload = {
  sessionId: string
  slug: PeerGameSlug
  conversationId: string
  state: Record<string, unknown>
  turnUserId: string | null
  status: PeerGameSessionStatus
  winnerUserId?: string | null
  moveCount: number
  byUserId: string
}
