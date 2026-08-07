/**
 * Peer game session expiry + orphan reclaim (A5 + B1).
 * Pending invite TTL 15m; active idle TTL 2h; orphans (pending, no messageId) short TTL.
 */

import 'server-only'

import { db, initializeDatabase } from '@/lib/database'
import { publishToChannel, publishToUserTunnel } from '@/lib/tunnel/publisher'
import { logger } from '@/lib/logger'
import type { GameRequestMetadata } from '@/features/chat/types'
import type { PeerGameSession } from './types'

const SESSIONS = 'peer_game_sessions'
const SCAN_LIMIT = 200

/** Pending invite without linked chat widget — reclaim quickly. */
export const ORPHAN_PENDING_TTL_MS = 2 * 60 * 1000
/** Pending invite with widget — expire after 15m. */
export const PENDING_INVITE_TTL_MS = 15 * 60 * 1000
/** Active game with no moves / updates — idle expire after 2h. */
export const ACTIVE_IDLE_TTL_MS = 2 * 60 * 60 * 1000

function nowIso() {
  return new Date().toISOString()
}

function updatedMs(session: PeerGameSession): number {
  const ms = new Date(session.updatedAt || session.createdAt).getTime()
  return Number.isFinite(ms) ? ms : 0
}

async function patchLinkedMessage(
  session: PeerGameSession,
  status: GameRequestMetadata['status'],
): Promise<void> {
  if (!session.messageId) return
  try {
    const { MessageService } = await import('@/features/chat/services/message-service')
    const messages = new MessageService()
    await messages.updateMessageLocked(session.messageId, (msg) => {
      const meta = msg.metadata as unknown as GameRequestMetadata | undefined
      if (msg.type !== 'game_request' && meta?.kind !== 'game_request') {
        throw new Error('Not a game_request message')
      }
      const next: GameRequestMetadata = {
        kind: 'game_request',
        slug: (meta?.slug || session.slug) as GameRequestMetadata['slug'],
        sessionId: session.id,
        status,
        challengerUserId: session.challengerUserId,
        peerUserId: session.peerUserId,
        winnerUserId: session.winnerUserId ?? null,
        title: meta?.title,
      }
      return { metadata: next as unknown as Record<string, unknown> }
    })
  } catch (err) {
    logger.warn('expirePeerGameSessions: updateMessageLocked failed', {
      sessionId: session.id,
      error: err,
    })
  }
}

async function terminateSession(
  session: PeerGameSession,
  status: 'declined' | 'completed',
  reason: string,
): Promise<void> {
  const stamp = nowIso()
  const next: PeerGameSession = {
    ...session,
    status: status === 'declined' ? 'declined' : 'completed',
    turnUserId: null,
    updatedAt: stamp,
    completedAt: stamp,
  }
  // Use resigned for idle active games so UI shows terminal without inventing winner.
  if (reason === 'active_idle') {
    next.status = 'resigned'
  }
  await db().updateDoc(SESSIONS, session.id, next)
  await patchLinkedMessage(next, next.status as GameRequestMetadata['status'])

  const payload = {
    sessionId: session.id,
    status: next.status,
    reason,
    expired: true,
  }
  await publishToChannel(`conversation:${session.conversationId}`, 'game:expire', payload)
  await publishToChannel(`game:${session.id}`, 'game:expire', payload)
  // Banner may not have finished subscribing to game:{id} yet — terminal on user inbox too.
  const terminal = {
    sessionId: session.id,
    slug: session.slug,
    conversationId: session.conversationId,
    fromUserId: session.challengerUserId,
    peerUserId: session.peerUserId,
    terminal: true,
    status: next.status,
  }
  await publishToUserTunnel(session.peerUserId, 'games:incoming', terminal)
  await publishToUserTunnel(session.challengerUserId, 'games:incoming', terminal)
}

/**
 * A5 — delete/expire pending sessions that never got a messageId (createInvite crash window).
 */
export async function reclaimOrphanPendingSessions(params?: {
  olderThanMs?: number
  limit?: number
}): Promise<{ scanned: number; reclaimed: number }> {
  await initializeDatabase()
  const olderThanMs = params?.olderThanMs ?? ORPHAN_PENDING_TTL_MS
  const limit = params?.limit ?? SCAN_LIMIT
  const cutoff = Date.now() - olderThanMs

  const r = await db().queryDocs<PeerGameSession>({
    collection: SESSIONS,
    filters: [{ field: 'status', operator: '==', value: 'pending' }],
    orderBy: [{ field: 'updatedAt', direction: 'asc' }],
    pagination: { limit },
  })
  const rows = r.success && r.data ? r.data : []
  let reclaimed = 0
  for (const row of rows) {
    if (row.messageId) continue
    if (updatedMs(row) > cutoff) continue
    try {
      await db().deleteDoc(SESSIONS, row.id)
      reclaimed += 1
    } catch (err) {
      logger.warn('reclaimOrphanPendingSessions delete failed', {
        sessionId: row.id,
        error: err,
      })
    }
  }
  return { scanned: rows.length, reclaimed }
}

/**
 * B1 — expire stale pending invites + idle active games; also runs orphan reclaim.
 */
export async function expirePeerGameSessions(): Promise<{
  success: boolean
  scanned: number
  expiredPending: number
  expiredActive: number
  orphansReclaimed: number
  duration: number
}> {
  const started = Date.now()
  try {
    const orphans = await reclaimOrphanPendingSessions()

    await initializeDatabase()
    const pendingR = await db().queryDocs<PeerGameSession>({
      collection: SESSIONS,
      filters: [{ field: 'status', operator: '==', value: 'pending' }],
      orderBy: [{ field: 'updatedAt', direction: 'asc' }],
      pagination: { limit: SCAN_LIMIT },
    })
    const activeR = await db().queryDocs<PeerGameSession>({
      collection: SESSIONS,
      filters: [{ field: 'status', operator: '==', value: 'active' }],
      orderBy: [{ field: 'updatedAt', direction: 'asc' }],
      pagination: { limit: SCAN_LIMIT },
    })

    const pending = pendingR.success && pendingR.data ? pendingR.data : []
    const active = activeR.success && activeR.data ? activeR.data : []
    const now = Date.now()

    let expiredPending = 0
    for (const session of pending) {
      if (!session.messageId) continue // orphans handled above
      if (now - updatedMs(session) < PENDING_INVITE_TTL_MS) continue
      await terminateSession(session, 'declined', 'pending_ttl')
      expiredPending += 1
    }

    let expiredActive = 0
    for (const session of active) {
      if (now - updatedMs(session) < ACTIVE_IDLE_TTL_MS) continue
      await terminateSession(session, 'completed', 'active_idle')
      expiredActive += 1
    }

    return {
      success: true,
      scanned: pending.length + active.length + orphans.scanned,
      expiredPending,
      expiredActive,
      orphansReclaimed: orphans.reclaimed,
      duration: Date.now() - started,
    }
  } catch (error) {
    logger.error('expirePeerGameSessions failed', { error })
    return {
      success: false,
      scanned: 0,
      expiredPending: 0,
      expiredActive: 0,
      orphansReclaimed: 0,
      duration: Date.now() - started,
    }
  }
}
