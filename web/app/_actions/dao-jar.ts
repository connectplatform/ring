'use server'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { auth } from '@/auth'
import { logger } from '@/lib/logger'
import type { DaoJarMetadata, Message } from '@/features/chat/types'
import type { PublicPoolDoc } from '@/lib/zod/public-pool-schemas'

export interface DaoJarActionResult {
  success: boolean
  error?: string
  message?: string
  messageId?: string
  conversationId?: string
  data?: Message
}

async function requireSession() {
  const session = await auth()
  if (!session?.user?.id) {
    return { session: null, error: 'Authentication required' as const }
  }
  return { session, error: null }
}

function poolToJarMeta(pool: PublicPoolDoc): DaoJarMetadata {
  return {
    kind: 'dao_jar',
    poolId: pool.id,
    poolSlug: pool.pool_slug,
    title: pool.title,
    goalRing: pool.goal_native_token,
    pledgedRing: pool.pledged_native_token,
    fundingMode: pool.funding_mode === 'escrow' ? 'escrow' : 'donation',
    status: pool.status,
  }
}

function revalidatePaths(conversationId?: string, poolSlug?: string) {
  revalidatePath('/[locale]/messages')
  revalidatePath('/[locale]/dao')
  if (conversationId) {
    revalidatePath(`/[locale]/messages?c=${conversationId}`)
  }
  if (poolSlug) {
    revalidatePath(`/[locale]/dao/${poolSlug}`)
  }
}

/** Post a dao_jar snapshot card into an existing conversation (chat owns snapshot only). */
export async function postDaoJarMessage(input: {
  conversationId: string
  poolSlug: string
}): Promise<DaoJarActionResult> {
  try {
    const { session, error } = await requireSession()
    if (!session) return { success: false, error: error ?? 'Authentication required' }

    const conversationId = String(input.conversationId || '').trim()
    const poolSlug = String(input.poolSlug || '').trim()
    if (!conversationId) return { success: false, error: 'Conversation is required' }
    if (!poolSlug) return { success: false, error: 'Pool slug is required' }

    const { ConversationService } = await import('@/features/chat/services/conversation-service')
    const { MessageService } = await import('@/features/chat/services/message-service')
    const { getPublicPoolConfig } = await import('@/lib/ring-config-core')
    const { findPoolBySlug } = await import('@/features/public-pools/lib/public-pool-db')

    const conversations = new ConversationService()
    const messages = new MessageService()
    const conversation = await conversations.getConversationById(conversationId, session.user.id)
    if (!conversation) return { success: false, error: 'Conversation not found' }

    const { cloneId } = getPublicPoolConfig()
    const pool = await findPoolBySlug(cloneId, poolSlug)
    if (!pool) return { success: false, error: 'Public pool not found' }

    const metadata = poolToJarMeta(pool)
    const message = await messages.sendMessage(
      {
        conversationId,
        content: `DAO jar: ${pool.title}`,
        type: 'dao_jar',
        metadata: metadata as unknown as Record<string, unknown>,
      },
      session.user.id,
      session.user.name || session.user.email || 'User',
      session.user.image || undefined,
    )

    revalidatePaths(conversationId, poolSlug)
    return {
      success: true,
      message: 'DAO jar posted',
      messageId: message.id,
      conversationId,
      data: message,
    }
  } catch (error) {
    logger.error('postDaoJarMessage failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to post DAO jar',
    }
  }
}

/**
 * Native RING contribute via public-pools (domain owns money), then refresh chat snapshot.
 * Does not use PaymentConductor.
 */
export async function contributeDaoJarFromChat(input: {
  messageId: string
  amountNativeToken: string
}): Promise<DaoJarActionResult> {
  try {
    const { session, error } = await requireSession()
    if (!session) return { success: false, error: error ?? 'Authentication required' }

    const messageId = String(input.messageId || '').trim()
    const amountNativeToken = String(input.amountNativeToken || '').trim()
    if (!messageId) return { success: false, error: 'Message is required' }
    if (!amountNativeToken) return { success: false, error: 'Amount is required' }

    const { loadMessageForParticipant } = await import(
      '@/features/chat/lib/load-message-for-participant'
    )
    const { MessageService } = await import('@/features/chat/services/message-service')
    const { contributeToPool } = await import(
      '@/features/public-pools/services/public-pool-service'
    )

    const access = await loadMessageForParticipant(messageId, session.user.id)
    if ('error' in access) return { success: false, error: access.error }
    const msg = access.message

    const messages = new MessageService()
    const meta = msg.metadata as unknown as DaoJarMetadata | undefined
    if (!meta || meta.kind !== 'dao_jar') {
      return { success: false, error: 'Not a DAO jar message' }
    }

    const role = (session.user.role as import('@/features/auth/user-role').UserRolesArray) || null

    await contributeToPool({
      poolSlug: meta.poolSlug,
      userId: session.user.id,
      userRole: role,
      amountNativeToken,
      idempotencyKey: randomUUID(),
      fundingMode: 'donation',
    })

    // contributeToPool already refreshes all open dao_jar snapshots (TD-UX-05).
    // Re-read this message so the action returns the live bubble.
    const updated = (await messages.getMessage(messageId)) ?? access.message

    revalidatePaths(msg.conversationId, meta.poolSlug)
    return {
      success: true,
      message: 'Contribution recorded',
      messageId,
      conversationId: msg.conversationId,
      data: updated,
    }
  } catch (error) {
    logger.error('contributeDaoJarFromChat failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to contribute',
    }
  }
}

/** Fan-out dao_jar snapshot cards into DMs (one message per contact). */
export async function postDaoJarToContacts(input: {
  poolSlug: string
  contactUserIds: string[]
}): Promise<{
  success: boolean
  error?: string
  message?: string
  conversationIds?: string[]
  messageIds?: string[]
}> {
  try {
    const { session, error } = await requireSession()
    if (!session) return { success: false, error: error ?? 'Authentication required' }

    const poolSlug = String(input.poolSlug || '').trim()
    const contactUserIds = Array.from(
      new Set(
        (input.contactUserIds || [])
          .map((id) => String(id || '').trim())
          .filter((id) => id && id !== session.user.id),
      ),
    )
    if (!poolSlug) return { success: false, error: 'Pool slug is required' }
    if (contactUserIds.length === 0) {
      return { success: false, error: 'Select at least one contact' }
    }
    if (contactUserIds.length > 25) {
      return { success: false, error: 'Maximum 25 contacts per post' }
    }

    const { ConversationService } = await import('@/features/chat/services/conversation-service')
    const { MessageService } = await import('@/features/chat/services/message-service')
    const { getPublicPoolConfig } = await import('@/lib/ring-config-core')
    const { findPoolBySlug } = await import('@/features/public-pools/lib/public-pool-db')

    const { cloneId } = getPublicPoolConfig()
    const pool = await findPoolBySlug(cloneId, poolSlug)
    if (!pool) return { success: false, error: 'Public pool not found' }

    const conversations = new ConversationService()
    const messages = new MessageService()
    const metadata = poolToJarMeta(pool)
    const content = `DAO jar: ${pool.title}`
    const conversationIds: string[] = []
    const messageIds: string[] = []

    for (const toUserId of contactUserIds) {
      let conversation = await conversations.findDirectConversation(session.user.id, toUserId)
      if (!conversation) {
        conversation = await conversations.createConversation({
          type: 'direct',
          participantIds: [session.user.id, toUserId],
          creatorUserId: session.user.id,
          metadata: { directUserId: toUserId },
        })
      }

      const message = await messages.sendMessage(
        {
          conversationId: conversation.id,
          content,
          type: 'dao_jar',
          metadata: metadata as unknown as Record<string, unknown>,
        },
        session.user.id,
        session.user.name || session.user.email || 'User',
        session.user.image || undefined,
      )
      conversationIds.push(conversation.id)
      messageIds.push(message.id)
    }

    revalidatePaths(undefined, poolSlug)
    return {
      success: true,
      message: `Jar posted to ${messageIds.length} chat${messageIds.length === 1 ? '' : 's'}`,
      conversationIds,
      messageIds,
    }
  } catch (error) {
    logger.error('postDaoJarToContacts failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to post DAO jar',
    }
  }
}
