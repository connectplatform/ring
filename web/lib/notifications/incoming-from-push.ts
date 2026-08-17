/**
 * Module-level bus: FCM onMessage (focused tab) → existing Tunnel banners.
 * One subscription per SW scope — this is not a second Chrome delivery path.
 */

import { PEER_GAME_SLUGS, type IncomingGameInvite, type PeerGameSlug } from '@/features/peer-games/types'
import type { IncomingCallInvite } from '@/hooks/use-webrtc-call'

export const INTERACTIVE_PUSH_TYPES = ['call_invite', 'game_request'] as const
export type InteractivePushType = (typeof INTERACTIVE_PUSH_TYPES)[number]

type CallListener = (invite: IncomingCallInvite) => void
type GameListener = (invite: IncomingGameInvite) => void

const callListeners = new Set<CallListener>()
const gameListeners = new Set<GameListener>()

export function isInteractivePushType(type: string | undefined): type is InteractivePushType {
  return type === 'call_invite' || type === 'game_request'
}

export function emitIncomingCallFromPush(invite: IncomingCallInvite): void {
  for (const listener of callListeners) listener(invite)
}

export function subscribeIncomingCallFromPush(listener: CallListener): () => void {
  callListeners.add(listener)
  return () => {
    callListeners.delete(listener)
  }
}

export function emitIncomingGameFromPush(invite: IncomingGameInvite): void {
  for (const listener of gameListeners) listener(invite)
}

export function subscribeIncomingGameFromPush(listener: GameListener): () => void {
  gameListeners.add(listener)
  return () => {
    gameListeners.delete(listener)
  }
}

export function parseJsonRecord(raw: string | undefined): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as unknown
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    return value as Record<string, unknown>
  } catch {
    return null
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function parseQueryParam(url: string | undefined, key: string): string | undefined {
  if (!url) return undefined
  try {
    const parsed = new URL(url, 'https://ring.local')
    return parsed.searchParams.get(key) || undefined
  } catch {
    return undefined
  }
}

export function parseCallInviteFromPushData(
  data: Record<string, string>,
): IncomingCallInvite | null {
  const meta = parseJsonRecord(data.metadata) ?? {}
  const type = data.type || asString(meta.kind)
  if (type !== 'call_invite') return null

  const clickAction = data.clickAction || data.actionUrl
  const callId =
    asString(meta.callId) || data.callId || parseQueryParam(clickAction, 'call')
  const conversationId =
    asString(meta.conversationId) ||
    data.conversationId ||
    parseQueryParam(clickAction, 'conversation') ||
    parseQueryParam(clickAction, 'c')
  const fromUserId = asString(meta.fromUserId) || data.fromUserId
  if (!callId || !conversationId || !fromUserId) return null

  const mediaRaw = asString(meta.media) || data.media
  const media = mediaRaw === 'video' ? 'video' : 'audio'

  return {
    callId,
    conversationId,
    fromUserId,
    media,
    fromUserName: asString(meta.fromUserName) || data.fromUserName,
  }
}

function asPeerGameSlug(value: unknown): PeerGameSlug | undefined {
  return PEER_GAME_SLUGS.includes(value as PeerGameSlug)
    ? (value as PeerGameSlug)
    : undefined
}

export function parseGameInviteFromPushData(
  data: Record<string, string>,
  peerUserId: string,
): IncomingGameInvite | null {
  const meta = parseJsonRecord(data.metadata) ?? {}
  const type = data.type || asString(meta.kind)
  if (type !== 'game_request') return null

  const sessionId = asString(meta.sessionId) || data.sessionId
  const slug = asPeerGameSlug(meta.slug) || asPeerGameSlug(data.slug)
  const conversationId = asString(meta.conversationId) || data.conversationId
  const fromUserId = asString(meta.fromUserId) || data.fromUserId
  if (!sessionId || !slug || !conversationId || !fromUserId) return null

  return {
    sessionId,
    slug,
    conversationId,
    messageId: asString(meta.messageId) || data.messageId,
    fromUserId,
    fromUserName: asString(meta.fromUserName) || data.fromUserName,
    peerUserId: asString(meta.peerUserId) || data.peerUserId || peerUserId,
  }
}

export function emitInteractivePushFromFcmData(
  data: Record<string, string>,
  peerUserId: string,
): boolean {
  const type = data.type || asString(parseJsonRecord(data.metadata)?.kind)
  if (type === 'call_invite') {
    const invite = parseCallInviteFromPushData(data)
    if (!invite) return false
    emitIncomingCallFromPush(invite)
    return true
  }
  if (type === 'game_request') {
    const invite = parseGameInviteFromPushData(data, peerUserId)
    if (!invite) return false
    emitIncomingGameFromPush(invite)
    return true
  }
  return false
}
