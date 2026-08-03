'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { logger } from '@/lib/logger'
import type { ChatInteractiveActionResult } from '@/app/_actions/chat-poll'
import type { PeerGameSession, PeerGameSlug } from '@/features/peer-games/types'
import { isPeerGameSlug } from '@/features/peer-games/catalog'

export type PeerGameActionResult = ChatInteractiveActionResult & {
  session?: PeerGameSession
  sessionId?: string
  enabledSlugs?: PeerGameSlug[]
}

async function requireSession() {
  const session = await auth()
  if (!session?.user?.id) {
    return { session: null, error: 'Authentication required' as const }
  }
  return { session, error: null }
}

function revalidateGames(conversationId?: string, username?: string) {
  revalidatePath('/[locale]/games')
  revalidatePath('/[locale]/messages')
  revalidatePath('/[locale]/profile/games')
  if (conversationId) {
    revalidatePath(`/[locale]/messages?c=${conversationId}`)
  }
  if (username) {
    revalidatePath(`/[locale]/${encodeURIComponent(username)}/games`)
  }
}

export async function createGameRequest(input: {
  conversationId: string
  slug: string
  peerUserId?: string
}): Promise<PeerGameActionResult> {
  try {
    const { session, error } = await requireSession()
    if (!session) return { success: false, error: error ?? 'Authentication required' }

    const conversationId = String(input.conversationId || '').trim()
    const slug = String(input.slug || '').trim()
    if (!conversationId) return { success: false, error: 'Conversation is required' }
    if (!isPeerGameSlug(slug)) return { success: false, error: 'Unknown game' }

    const { createInvite } = await import('@/features/peer-games/service')
    const result = await createInvite({
      conversationId,
      slug,
      challengerUserId: session.user.id,
      challengerName: session.user.name || session.user.email || 'User',
      challengerRole: session.user.role as string | undefined,
      peerUserId: input.peerUserId,
    })

    revalidateGames(conversationId)
    return {
      success: true,
      message: 'Game request sent',
      messageId: result.messageId,
      sessionId: result.session.id,
      session: result.session,
    }
  } catch (err) {
    logger.error('createGameRequest failed', { error: err })
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create game request',
    }
  }
}

export async function acceptGameRequest(input: {
  sessionId: string
}): Promise<PeerGameActionResult> {
  try {
    const { session, error } = await requireSession()
    if (!session) return { success: false, error: error ?? 'Authentication required' }
    const sessionId = String(input.sessionId || '').trim()
    if (!sessionId) return { success: false, error: 'Session is required' }

    const { acceptSession } = await import('@/features/peer-games/service')
    const game = await acceptSession(sessionId, session.user.id)
    revalidateGames(game.conversationId)
    return { success: true, message: 'Game accepted', session: game, sessionId }
  } catch (err) {
    logger.error('acceptGameRequest failed', { error: err })
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to accept',
    }
  }
}

export async function declineGameRequest(input: {
  sessionId: string
}): Promise<PeerGameActionResult> {
  try {
    const { session, error } = await requireSession()
    if (!session) return { success: false, error: error ?? 'Authentication required' }
    const sessionId = String(input.sessionId || '').trim()
    if (!sessionId) return { success: false, error: 'Session is required' }

    const { declineSession } = await import('@/features/peer-games/service')
    const game = await declineSession(sessionId, session.user.id)
    revalidateGames(game.conversationId)
    return { success: true, message: 'Game declined', session: game, sessionId }
  } catch (err) {
    logger.error('declineGameRequest failed', { error: err })
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to decline',
    }
  }
}

export async function resignPeerGameAction(input: {
  sessionId: string
}): Promise<PeerGameActionResult> {
  try {
    const { session, error } = await requireSession()
    if (!session) return { success: false, error: error ?? 'Authentication required' }
    const sessionId = String(input.sessionId || '').trim()
    if (!sessionId) return { success: false, error: 'Session is required' }

    const { resignSession } = await import('@/features/peer-games/service')
    const game = await resignSession(sessionId, session.user.id)
    revalidateGames(game.conversationId)
    return { success: true, message: 'Resigned', session: game, sessionId }
  } catch (err) {
    logger.error('resignPeerGameAction failed', { error: err })
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to resign',
    }
  }
}

export async function submitPeerGameMoveAction(input: {
  sessionId: string
  move: Record<string, unknown>
}): Promise<PeerGameActionResult> {
  try {
    const { session, error } = await requireSession()
    if (!session) return { success: false, error: error ?? 'Authentication required' }
    const sessionId = String(input.sessionId || '').trim()
    if (!sessionId) return { success: false, error: 'Session is required' }

    const { submitMove } = await import('@/features/peer-games/service')
    const game = await submitMove({
      sessionId,
      userId: session.user.id,
      move: input.move || {},
    })
    return { success: true, message: 'Move applied', session: game, sessionId }
  } catch (err) {
    logger.error('submitPeerGameMoveAction failed', { error: err })
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to submit move',
    }
  }
}

export async function getPeerGameSessionAction(input: {
  sessionId: string
}): Promise<PeerGameActionResult> {
  try {
    const { session, error } = await requireSession()
    if (!session) return { success: false, error: error ?? 'Authentication required' }
    const sessionId = String(input.sessionId || '').trim()
    if (!sessionId) return { success: false, error: 'Session is required' }

    const { getSessionForParticipant } = await import('@/features/peer-games/service')
    const game = await getSessionForParticipant(sessionId, session.user.id)
    if (!game) return { success: false, error: 'Session not found' }
    return { success: true, session: game, sessionId }
  } catch (err) {
    logger.error('getPeerGameSessionAction failed', { error: err })
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load session',
    }
  }
}

export async function updateEnabledGamesAction(input: {
  enabledSlugs: string[]
}): Promise<PeerGameActionResult> {
  try {
    const { session, error } = await requireSession()
    if (!session) return { success: false, error: error ?? 'Authentication required' }

    const { setUserEnabledGames } = await import('@/features/peer-games/service')
    const doc = await setUserEnabledGames({
      ownerId: session.user.id,
      role: session.user.role as string | undefined,
      username: session.user.username as string | undefined,
      enabledSlugs: input.enabledSlugs || [],
    })
    revalidateGames(undefined, doc.username)
    return {
      success: true,
      message: 'Availability updated',
      enabledSlugs: doc.enabledSlugs,
    }
  } catch (err) {
    logger.error('updateEnabledGamesAction failed', { error: err })
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update availability',
    }
  }
}

/** Profile Play-with-me: open/create DM then createInvite. */
export async function challengeUserToGameAction(input: {
  targetUserId: string
  slug: string
}): Promise<PeerGameActionResult & { conversationId?: string }> {
  try {
    const { session, error } = await requireSession()
    if (!session) return { success: false, error: error ?? 'Authentication required' }

    const targetUserId = String(input.targetUserId || '').trim()
    const slug = String(input.slug || '').trim()
    if (!targetUserId) return { success: false, error: 'Target user required' }
    if (!isPeerGameSlug(slug)) return { success: false, error: 'Unknown game' }
    if (targetUserId === session.user.id) {
      return { success: false, error: 'Cannot challenge yourself' }
    }

    const { listPublicEnabledGamesForOwner } = await import(
      '@/features/peer-games/service'
    )
    const enabled = await listPublicEnabledGamesForOwner(targetUserId)
    if (!enabled.includes(slug)) {
      return {
        success: false,
        error: 'That game is not on their public availability list',
      }
    }

    const { ConversationService } = await import(
      '@/features/chat/services/conversation-service'
    )
    const conversations = new ConversationService()
    const conversation = await conversations.createConversation({
      type: 'direct',
      participantIds: [session.user.id, targetUserId],
      creatorUserId: session.user.id,
      metadata: { directUserId: targetUserId },
    })

    const { createInvite } = await import('@/features/peer-games/service')
    const result = await createInvite({
      conversationId: conversation.id,
      slug,
      challengerUserId: session.user.id,
      challengerName: session.user.name || session.user.email || 'User',
      challengerRole: session.user.role as string | undefined,
      peerUserId: targetUserId,
    })

    revalidateGames(conversation.id)
    return {
      success: true,
      message: 'Challenge sent',
      messageId: result.messageId,
      sessionId: result.session.id,
      session: result.session,
      conversationId: conversation.id,
    }
  } catch (err) {
    logger.error('challengeUserToGameAction failed', { error: err })
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to challenge',
    }
  }
}
