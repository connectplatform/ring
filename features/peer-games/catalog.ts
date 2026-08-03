/**
 * Peer Games catalog — static registry (tic-tac-toe, chess, checkers).
 * UPGRADE: white-label filter via ring-config.features.peerGames.enabledSlugs
 * UPGRADE: sea-battle, bingo; P2: go + matchmaking
 */

import type { PeerGameSlug } from './types'
import { PEER_GAME_SLUGS } from './types'

export type PeerGameCatalogEntry = {
  slug: PeerGameSlug
  title: string
  description: string
  minPlayers: number
  maxPlayers: number
  /** Rough board complexity for marketplace sort. */
  complexity: 'easy' | 'medium' | 'hard'
}

export const PEER_GAME_CATALOG: readonly PeerGameCatalogEntry[] = [
  {
    slug: 'tic-tac-toe',
    title: 'Tic-Tac-Toe',
    description: 'Classic 3×3. First to three in a row wins.',
    minPlayers: 2,
    maxPlayers: 2,
    complexity: 'easy',
  },
  {
    slug: 'chess',
    title: 'Chess',
    description: 'Standard chess. White moves first.',
    minPlayers: 2,
    maxPlayers: 2,
    complexity: 'hard',
  },
  {
    slug: 'checkers',
    title: 'Checkers',
    description: 'English draughts on an 8×8 board. Forced captures.',
    minPlayers: 2,
    maxPlayers: 2,
    complexity: 'medium',
  },
] as const

export function getCatalogEntry(slug: string): PeerGameCatalogEntry | null {
  return PEER_GAME_CATALOG.find((e) => e.slug === slug) ?? null
}

export function isPeerGameSlug(value: string): value is PeerGameSlug {
  return (PEER_GAME_SLUGS as readonly string[]).includes(value)
}

export function listCatalog(): readonly PeerGameCatalogEntry[] {
  return PEER_GAME_CATALOG
}
