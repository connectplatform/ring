/**
 * PeerGameService — Tunnel-authoritative sessions (DB SSOT).
 * No GameConductor.
 *
 * P1: session-expiry ProcessConductor · FCM when Tunnel offline ·
 * DataChannel optimistic preview (client) · Tunnel subscribe ACL for game:*.
 */

import 'server-only'

import { randomUUID } from 'crypto'
import { cache } from 'react'
import { db, initializeDatabase } from '@/lib/database'
import { publishToChannel, publishToUserTunnel } from '@/lib/tunnel/publisher'
import { hasMemberPrivileges, resolveSessionUserRole } from '@/features/auth/user-role'
import { getCatalogEntry, isPeerGameSlug } from './catalog'
import { getGameLogic } from './plugins/registry'
import {
  peerGameSessionSchema,
  userPeerGamesSchema,
  type IncomingGameInvite,
  type PeerGameSession,
  type PeerGameSlug,
  type PeerGameSessionStatus,
  type UserPeerGames,
} from './types'
import type { GameRequestMetadata } from '@/features/chat/types'

const SESSIONS = 'peer_game_sessions'
const USER_GAMES = 'user_peer_games'

function nowIso() {
  return new Date().toISOString()
}

function normalizeSession(
  row: Record<string, unknown> & { id?: string },
): PeerGameSession {
  return peerGameSessionSchema.parse({
    ...row,
    id: row.id || (row as { _id?: string })._id,
    moveCount: typeof row.moveCount === 'number' ? row.moveCount : 0,
    turnUserId: row.turnUserId ?? null,
    winnerUserId: row.winnerUserId ?? null,
    state: (row.state && typeof row.state === 'object'
      ? row.state
      : {}) as Record<string, unknown>,
  })
}

function normalizeUserGames(
  row: Record<string, unknown> & { id?: string },
): UserPeerGames {
  return userPeerGamesSchema.parse({
    ...row,
    id: row.id || (row as { _id?: string })._id,
    visibility: 'public',
    enabledSlugs: Array.isArray(row.enabledSlugs) ? row.enabledSlugs : [],
  })
}

function isParticipant(session: PeerGameSession, userId: string): boolean {
  return (
    session.challengerUserId === userId ||
    session.peerUserId === userId ||
    session.playerIds.includes(userId)
  )
}

async function patchLinkedMessage(
  session: PeerGameSession,
  actorUserId: string,
  patch: Partial<GameRequestMetadata>,
): Promise<void> {
  if (!session.messageId) return
  const { MessageService } = await import('@/features/chat/services/message-service')
  const messages = new MessageService()
  await messages.updateMessageLocked(session.messageId, (msg) => {
    const meta = msg.metadata as unknown as GameRequestMetadata | undefined
    if (msg.type !== 'game_request' && meta?.kind !== 'game_request') {
      throw new Error('Not a game_request message')
    }
    const next: GameRequestMetadata = {
      kind: 'game_request',
      slug: session.slug,
      sessionId: session.id,
      status: session.status,
      challengerUserId: session.challengerUserId,
      peerUserId: session.peerUserId,
      winnerUserId: session.winnerUserId ?? null,
      title: meta?.title,
      ...patch,
    }
    return { metadata: next as unknown as Record<string, unknown> }
  })
  void actorUserId
}

export const getSession = cache(
  async (sessionId: string): Promise<PeerGameSession | null> => {
    await initializeDatabase()
    const r = await db().readDoc<PeerGameSession>(SESSIONS, sessionId)
    if (!r.success || !r.data) return null
    try {
      return normalizeSession({
        ...(r.data as unknown as Record<string, unknown>),
        id: sessionId,
      })
    } catch {
      return null
    }
  },
)

/** Uncached read for mutations (avoid React.cache stale). */
export async function readSessionFresh(
  sessionId: string,
): Promise<PeerGameSession | null> {
  await initializeDatabase()
  const r = await db().readDoc<PeerGameSession>(SESSIONS, sessionId)
  if (!r.success || !r.data) return null
  try {
    return normalizeSession({
      ...(r.data as unknown as Record<string, unknown>),
      id: sessionId,
    })
  } catch {
    return null
  }
}

export async function getSessionForParticipant(
  sessionId: string,
  userId: string,
): Promise<PeerGameSession | null> {
  const session = await readSessionFresh(sessionId)
  if (!session || !isParticipant(session, userId)) return null
  return session
}

export type CreateInviteInput = {
  conversationId: string
  slug: PeerGameSlug
  challengerUserId: string
  challengerName?: string
  challengerRole?: string | null
  peerUserId?: string
}

export type CreateInviteResult = {
  session: PeerGameSession
  messageId: string
  invite: IncomingGameInvite
}

/**
 * SSOT invite path — used by createGameRequest action and thin HTTP twin.
 */
export async function createInvite(
  input: CreateInviteInput,
): Promise<CreateInviteResult> {
  await initializeDatabase()

  if (!isPeerGameSlug(input.slug) || !getCatalogEntry(input.slug)) {
    throw new Error('Unknown game')
  }
  const logic = getGameLogic(input.slug)
  if (!logic) throw new Error('Game plugin missing')

  const role = resolveSessionUserRole(input.challengerRole as string)
  if (!hasMemberPrivileges(role)) {
    throw new Error('Member privileges required to challenge')
  }

  const { ConversationService } = await import(
    '@/features/chat/services/conversation-service'
  )
  const { MessageService } = await import('@/features/chat/services/message-service')
  const conversations = new ConversationService()
  const messages = new MessageService()

  const conversation = await conversations.getConversationById(
    input.conversationId,
    input.challengerUserId,
  )
  if (!conversation) throw new Error('Conversation not found')
  if (conversation.type !== 'direct') {
    throw new Error('Only direct conversations support game invites')
  }

  const challengerOk = conversation.participants.some(
    (p) => p.userId === input.challengerUserId,
  )
  if (!challengerOk) throw new Error('Forbidden')

  const peerUserId =
    input.peerUserId ||
    conversation.participants.find((p) => p.userId !== input.challengerUserId)
      ?.userId
  if (!peerUserId) throw new Error('Peer not found')
  if (peerUserId === input.challengerUserId) throw new Error('Invalid peer')

  const peerOk = conversation.participants.some((p) => p.userId === peerUserId)
  if (!peerOk) throw new Error('Forbidden')

  // Multi-pod dedupe on real peer id (action + HTTP). Claim first; release on failure
  // so failed creates remain retryable (plan lock).
  const { setNxPx, releaseNx } = await import('@/lib/redis/set-nx')
  const INVITE_TTL_MS = 10 * 60 * 1000
  const dedupeKey = `peer-game:invite:${input.challengerUserId}:${peerUserId}:${input.slug}`
  const claim = await setNxPx(dedupeKey, INVITE_TTL_MS)
  if (!claim.claimed) {
    throw new Error('Invite already sent recently')
  }

  const sessionId = randomUUID()
  const stamp = nowIso()
  const playerIds: [string, string] = [input.challengerUserId, peerUserId]
  const initial = logic.initialState(playerIds)

  const sessionDoc: PeerGameSession = {
    id: sessionId,
    slug: input.slug,
    status: 'pending',
    conversationId: input.conversationId,
    challengerUserId: input.challengerUserId,
    peerUserId,
    playerIds,
    turnUserId: playerIds[0],
    winnerUserId: null,
    state: initial,
    moveCount: 0,
    createdAt: stamp,
    updatedAt: stamp,
  }

  // Persist session first — avoid orphan game_request widgets if createDoc fails.
  const created = await db().createDoc(SESSIONS, sessionDoc, { id: sessionId })
  if (!created.success) {
    await releaseNx(dedupeKey)
    throw created.error || new Error('Failed to create session')
  }

  const catalog = getCatalogEntry(input.slug)!
  const metadata: GameRequestMetadata = {
    kind: 'game_request',
    slug: input.slug,
    sessionId,
    status: 'pending',
    challengerUserId: input.challengerUserId,
    peerUserId,
    title: catalog.title,
  }

  let message
  try {
    message = await messages.sendMessage(
      {
        conversationId: input.conversationId,
        content: `Game request: ${catalog.title}`,
        type: 'game_request',
        metadata: metadata as unknown as Record<string, unknown>,
      },
      input.challengerUserId,
      input.challengerName || 'User',
      undefined,
    )
  } catch (err) {
    // Best-effort cleanup so pending sessions without widgets do not linger.
    try {
      await db().deleteDoc(SESSIONS, sessionId)
    } catch {
      /* non-fatal */
    }
    await releaseNx(dedupeKey)
    throw err
  }

  sessionDoc.messageId = message.id
  const linked = await db().updateDoc(SESSIONS, sessionId, {
    messageId: message.id,
    updatedAt: nowIso(),
  })
  if (!linked.success) {
    // Message already visible — keep session; messageId hydrate may retry via widget sessionId.
    console.error('createInvite: failed to link messageId on session', linked.error)
  }

  const invite: IncomingGameInvite = {
    sessionId,
    slug: input.slug,
    conversationId: input.conversationId,
    messageId: message.id,
    fromUserId: input.challengerUserId,
    fromUserName: input.challengerName || 'User',
    peerUserId,
  }

  await publishToChannel(`conversation:${input.conversationId}`, 'game:invite', invite)
  // Global banner (MessagesShell + /games layout). In-app notify via interactive kit on sendMessage.
  const tunnelDelivery = await publishToUserTunnel(peerUserId, 'games:incoming', invite)

  // Offline fallback: FCM GAME_REQUEST only — never call ringtone / setPeerCallBusy.
  // Mid-connect may queue games:incoming (!deliveredLive) while TunnelProvider grace (~400ms)
  // is still connecting — wait then recheck presence before push.
  if (!tunnelDelivery.deliveredLive) {
    await new Promise((r) => setTimeout(r, 500))
    const { getTunnelHub } = await import('@/lib/tunnel/hub')
    const stillOffline = !getTunnelHub().isUserConnected(peerUserId)
    if (stillOffline) {
      try {
        const {
          createNotification,
        } = await import('@/features/notifications/services/notification-service')
        const {
          NotificationType,
          NotificationChannel,
          NotificationPriority,
        } = await import('@/features/notifications/types')
        await createNotification({
          userId: peerUserId,
          type: NotificationType.GAME_REQUEST,
          priority: NotificationPriority.HIGH,
          title: `${input.challengerName || 'Someone'} challenged you`,
          body: `${catalog.title} — open Games to accept`,
          data: {
            actionUrl: `/games/${input.slug}?session=${sessionId}`,
            metadata: {
              kind: 'game_request',
              sessionId,
              slug: input.slug,
              conversationId: input.conversationId,
              messageId: message.id,
              fromUserId: input.challengerUserId,
            },
          },
          channels: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
          actionText: 'Open game',
          actionUrl: `/games/${input.slug}?session=${sessionId}`,
        })
      } catch (err) {
        console.warn('createInvite: FCM GAME_REQUEST fallback failed', err)
      }
    }
  }

  return { session: sessionDoc, messageId: message.id, invite }
}

async function writeSession(session: PeerGameSession): Promise<PeerGameSession> {
  const next = { ...session, updatedAt: nowIso() }
  const r = await db().updateDoc(SESSIONS, session.id, next)
  if (!r.success) throw r.error || new Error('Failed to update session')
  return next
}

export async function acceptSession(
  sessionId: string,
  userId: string,
): Promise<PeerGameSession> {
  const session = await readSessionFresh(sessionId)
  if (!session) throw new Error('Session not found')
  if (session.peerUserId !== userId) throw new Error('Only the challenged peer can accept')
  if (session.status !== 'pending') throw new Error('Invite is no longer pending')

  const next: PeerGameSession = {
    ...session,
    status: 'active',
    turnUserId: session.playerIds[0],
  }
  const saved = await writeSession(next)
  await patchLinkedMessage(saved, userId, { status: 'active' })

  await publishToChannel(`conversation:${session.conversationId}`, 'game:accept', {
    sessionId,
    byUserId: userId,
  })
  await publishToChannel(`game:${sessionId}`, 'game:accept', {
    sessionId,
    status: 'active',
    turnUserId: saved.turnUserId,
  })
  await publishToUserTunnel(session.challengerUserId, 'games:incoming', {
    sessionId,
    slug: session.slug,
    conversationId: session.conversationId,
    fromUserId: userId,
    peerUserId: session.challengerUserId,
    accepted: true,
  })

  return saved
}

export async function declineSession(
  sessionId: string,
  userId: string,
): Promise<PeerGameSession> {
  const session = await readSessionFresh(sessionId)
  if (!session) throw new Error('Session not found')
  if (session.peerUserId !== userId && session.challengerUserId !== userId) {
    throw new Error('Forbidden')
  }
  if (session.status !== 'pending') throw new Error('Invite is no longer pending')

  const next: PeerGameSession = { ...session, status: 'declined', turnUserId: null }
  const saved = await writeSession(next)
  await patchLinkedMessage(saved, userId, { status: 'declined' })

  await publishToChannel(`conversation:${session.conversationId}`, 'game:decline', {
    sessionId,
    byUserId: userId,
  })
  await publishToChannel(`game:${sessionId}`, 'game:decline', { sessionId, status: 'declined' })
  // Clear IncomingGameBanner if peer has not subscribed to game:{id} yet.
  const terminal = {
    sessionId,
    slug: session.slug,
    conversationId: session.conversationId,
    fromUserId: session.challengerUserId,
    peerUserId: session.peerUserId,
    terminal: true,
    status: 'declined' as const,
  }
  await publishToUserTunnel(session.peerUserId, 'games:incoming', terminal)
  await publishToUserTunnel(session.challengerUserId, 'games:incoming', terminal)

  return saved
}

export async function resignSession(
  sessionId: string,
  userId: string,
): Promise<PeerGameSession> {
  const session = await readSessionFresh(sessionId)
  if (!session) throw new Error('Session not found')
  if (!isParticipant(session, userId)) throw new Error('Forbidden')
  if (session.status !== 'active' && session.status !== 'pending') {
    throw new Error('Game already finished')
  }

  const winnerUserId =
    session.playerIds.find((id) => id !== userId) ?? null
  const next: PeerGameSession = {
    ...session,
    status: 'resigned',
    turnUserId: null,
    winnerUserId,
    completedAt: nowIso(),
  }
  const saved = await writeSession(next)
  await patchLinkedMessage(saved, userId, {
    status: 'resigned',
    winnerUserId,
  })

  const payload = {
    sessionId,
    status: 'resigned' as PeerGameSessionStatus,
    winnerUserId,
    byUserId: userId,
  }
  await publishToChannel(`conversation:${session.conversationId}`, 'game:resign', payload)
  await publishToChannel(`game:${sessionId}`, 'game:resign', payload)

  return saved
}

export async function submitMove(params: {
  sessionId: string
  userId: string
  move: Record<string, unknown>
}): Promise<PeerGameSession> {
  const session = await readSessionFresh(params.sessionId)
  if (!session) throw new Error('Session not found')
  if (!isParticipant(session, params.userId)) throw new Error('Forbidden')
  if (session.status !== 'active') throw new Error('Game is not active')
  if (session.turnUserId && session.turnUserId !== params.userId) {
    throw new Error('Not your turn')
  }

  const logic = getGameLogic(session.slug)
  if (!logic) throw new Error('Game plugin missing')

  const validated = logic.validateMove({
    state: session.state,
    move: params.move,
    byUserId: params.userId,
    playerIds: session.playerIds,
  })
  if (validated.ok === false) throw new Error(validated.error)

  const applied = logic.applyMove({
    state: session.state,
    move: params.move,
    byUserId: params.userId,
    playerIds: session.playerIds,
  })

  const next: PeerGameSession = {
    ...session,
    state: applied.state,
    turnUserId: applied.turnUserId,
    status: applied.status === 'completed' ? 'completed' : 'active',
    winnerUserId:
      applied.status === 'completed' ? (applied.winnerUserId ?? null) : session.winnerUserId,
    moveCount: session.moveCount + 1,
    completedAt: applied.status === 'completed' ? nowIso() : session.completedAt,
  }
  const saved = await writeSession(next)

  if (saved.status === 'completed') {
    await patchLinkedMessage(saved, params.userId, {
      status: 'completed',
      winnerUserId: saved.winnerUserId ?? null,
    })
  }

  const payload = {
    sessionId: saved.id,
    slug: saved.slug,
    conversationId: saved.conversationId,
    state: saved.state,
    turnUserId: saved.turnUserId,
    status: saved.status,
    winnerUserId: saved.winnerUserId ?? null,
    moveCount: saved.moveCount,
    byUserId: params.userId,
  }

  // Fan-out on both channels — thread stay-in-sync + mini-app hydrate
  await publishToChannel(`game:${saved.id}`, 'game:move', payload)
  await publishToChannel(`conversation:${saved.conversationId}`, 'game:move', payload)

  return saved
}

function userGamesDocId(ownerId: string): string {
  return `upg_${ownerId}`
}

export async function getUserPeerGames(ownerId: string): Promise<UserPeerGames | null> {
  await initializeDatabase()
  if (!ownerId) return null
  const id = userGamesDocId(ownerId)
  const r = await db().readDoc<UserPeerGames>(USER_GAMES, id)
  if (!r.success || !r.data) return null
  try {
    return normalizeUserGames({
      ...(r.data as unknown as Record<string, unknown>),
      id,
    })
  } catch {
    return null
  }
}

export async function listPublicEnabledGamesForOwner(
  ownerId: string,
): Promise<PeerGameSlug[]> {
  const doc = await getUserPeerGames(ownerId)
  if (!doc || doc.visibility !== 'public') return []
  return doc.enabledSlugs.filter(isPeerGameSlug)
}

export async function setUserEnabledGames(params: {
  ownerId: string
  role: string | null | undefined
  username?: string
  enabledSlugs: string[]
}): Promise<UserPeerGames> {
  await initializeDatabase()
  const role = resolveSessionUserRole(params.role as string)
  if (!hasMemberPrivileges(role)) {
    throw new Error('Member privileges required to publish availability')
  }

  const enabledSlugs = params.enabledSlugs.filter(isPeerGameSlug)
  const id = userGamesDocId(params.ownerId)
  const stamp = nowIso()
  const existing = await getUserPeerGames(params.ownerId)

  const doc: UserPeerGames = {
    id,
    ownerId: params.ownerId,
    username: params.username?.replace(/^@/, '').trim().toLowerCase(),
    visibility: 'public',
    enabledSlugs,
    createdAt: existing?.createdAt || stamp,
    updatedAt: stamp,
  }
  const parsed = userPeerGamesSchema.parse(doc)

  if (existing) {
    const r = await db().updateDoc(USER_GAMES, id, parsed)
    if (!r.success) throw r.error || new Error('Failed to update availability')
  } else {
    const r = await db().createDoc(USER_GAMES, parsed, { id })
    if (!r.success) throw r.error || new Error('Failed to create availability')
  }
  return parsed
}
