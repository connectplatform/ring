'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { logger } from '@/lib/logger'
import type { Message, RsvpMetadata } from '@/features/chat/types'

export interface ChatInteractiveActionResult {
  success: boolean
  error?: string
  message?: string
  messageId?: string
  data?: Message
}

async function requireSession() {
  const session = await auth()
  if (!session?.user?.id) {
    return { session: null, error: 'Authentication required' as const }
  }
  return { session, error: null }
}

function revalidateConversation(conversationId?: string) {
  revalidatePath('/[locale]/messages')
  if (conversationId) {
    revalidatePath(`/[locale]/messages?c=${conversationId}`)
  }
}

export async function createRsvpMessage(input: {
  conversationId: string
  title: string
  binding: RsvpMetadata['binding']
  startsAt?: string
  locationLabel?: string
}): Promise<ChatInteractiveActionResult> {
  try {
    const { session, error } = await requireSession()
    if (!session) return { success: false, error: error ?? 'Authentication required' }

    const conversationId = String(input.conversationId || '').trim()
    const title = String(input.title || '').trim()
    if (!conversationId) return { success: false, error: 'Conversation is required' }
    if (!title) return { success: false, error: 'Title is required' }
    if (!input.binding?.targetType || !input.binding?.targetId) {
      return { success: false, error: 'RSVP binding is required' }
    }

    const { ConversationService } = await import('@/features/chat/services/conversation-service')
    const { MessageService } = await import('@/features/chat/services/message-service')
    const conversations = new ConversationService()
    const messages = new MessageService()

    const conversation = await conversations.getConversationById(conversationId, session.user.id)
    if (!conversation) return { success: false, error: 'Conversation not found' }

    const metadata: RsvpMetadata = {
      kind: 'rsvp',
      title,
      binding: {
        targetType: input.binding.targetType,
        targetId: String(input.binding.targetId).trim(),
      },
      startsAt: input.startsAt?.trim() || undefined,
      locationLabel: input.locationLabel?.trim() || undefined,
      status: 'open',
      responses: {},
      createdByUserId: session.user.id,
    }

    const message = await messages.sendMessage(
      {
        conversationId,
        content: `RSVP: ${title}`,
        type: 'rsvp',
        metadata: metadata as unknown as Record<string, unknown>,
      },
      session.user.id,
      session.user.name || session.user.email || 'User',
      session.user.image || undefined,
    )

    revalidateConversation(conversationId)
    return { success: true, message: 'RSVP created', messageId: message.id, data: message }
  } catch (error) {
    logger.error('createRsvpMessage failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create RSVP',
    }
  }
}

/** Fan-out RSVP cards into DMs (one message per contact). Used for meetup invites (TD-UX-01). */
export async function createRsvpToContacts(input: {
  title: string
  binding: RsvpMetadata['binding']
  startsAt?: string
  locationLabel?: string
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

    const title = String(input.title || '').trim()
    const contactUserIds = Array.from(
      new Set(
        (input.contactUserIds || [])
          .map((id) => String(id || '').trim())
          .filter((id) => id && id !== session.user.id),
      ),
    )
    if (!title) return { success: false, error: 'Title is required' }
    if (!input.binding?.targetType || !input.binding?.targetId) {
      return { success: false, error: 'RSVP binding is required' }
    }
    if (contactUserIds.length === 0) {
      return { success: false, error: 'Select at least one contact' }
    }
    if (contactUserIds.length > 25) {
      return { success: false, error: 'Maximum 25 contacts per invite' }
    }

    const { ConversationService } = await import('@/features/chat/services/conversation-service')
    const { MessageService } = await import('@/features/chat/services/message-service')
    const conversations = new ConversationService()
    const messages = new MessageService()

    const metadata: RsvpMetadata = {
      kind: 'rsvp',
      title,
      binding: {
        targetType: input.binding.targetType,
        targetId: String(input.binding.targetId).trim(),
      },
      startsAt: input.startsAt?.trim() || undefined,
      locationLabel: input.locationLabel?.trim() || undefined,
      status: 'open',
      responses: {},
      createdByUserId: session.user.id,
    }

    const content = `RSVP: ${title}`
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
          type: 'rsvp',
          metadata: metadata as unknown as Record<string, unknown>,
        },
        session.user.id,
        session.user.name || session.user.email || 'User',
        session.user.image || undefined,
      )
      conversationIds.push(conversation.id)
      messageIds.push(message.id)
    }

    revalidateConversation()
    return {
      success: true,
      message: `RSVP sent to ${messageIds.length} chat${messageIds.length === 1 ? '' : 's'}`,
      conversationIds,
      messageIds,
    }
  } catch (error) {
    logger.error('createRsvpToContacts failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to invite RSVP',
    }
  }
}

export async function respondRsvp(input: {
  messageId: string
  response: 'going' | 'maybe' | 'declined'
}): Promise<ChatInteractiveActionResult> {
  try {
    const { session, error } = await requireSession()
    if (!session) return { success: false, error: error ?? 'Authentication required' }

    const messageId = String(input.messageId || '').trim()
    const response = input.response
    if (!messageId) return { success: false, error: 'Message is required' }
    if (!['going', 'maybe', 'declined'].includes(response)) {
      return { success: false, error: 'Invalid RSVP response' }
    }

    const { loadMessageForParticipant } = await import(
      '@/features/chat/lib/load-message-for-participant'
    )
    const { MessageService } = await import('@/features/chat/services/message-service')

    const access = await loadMessageForParticipant(messageId, session.user.id)
    if ('error' in access) return { success: false, error: access.error }

    const messages = new MessageService()
    const userId = session.user.id

    const updated = await messages.updateMessageLocked(messageId, (msg) => {
      const meta = msg.metadata as unknown as RsvpMetadata | undefined
      if (!meta || meta.kind !== 'rsvp') throw new Error('Not an RSVP message')
      if (meta.status !== 'open') throw new Error('RSVP is closed')

      const nextMeta: RsvpMetadata = {
        ...meta,
        responses: {
          ...meta.responses,
          [userId]: response,
        },
      }
      return { metadata: nextMeta as unknown as Record<string, unknown> }
    })

    const nextMeta = updated.metadata as unknown as RsvpMetadata

    // Best-effort: append user to meetup.participants when going
    if (
      response === 'going' &&
      nextMeta.binding.targetType === 'meetup' &&
      nextMeta.binding.targetId
    ) {
      try {
        const { initializeDatabase, getDatabaseService } = await import(
          '@/lib/database'
        )
        await initializeDatabase()
        const dbSvc = getDatabaseService()
        const meetup = await dbSvc.findById('meetups', nextMeta.binding.targetId)
        if (meetup.success && meetup.data) {
          const row = meetup.data as { participants?: unknown }
          const participants = Array.isArray(row.participants)
            ? [...row.participants]
            : []
          if (!participants.includes(session.user.id)) {
            participants.push(session.user.id)
            await dbSvc.update('meetups', nextMeta.binding.targetId, { participants })
          }
        }
      } catch (syncError) {
        logger.warn('RSVP meetup participant sync skipped', { syncError })
      }
    }

    revalidateConversation(access.conversationId)
    return { success: true, message: 'RSVP recorded', messageId, data: updated }
  } catch (error) {
    logger.error('respondRsvp failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to respond',
    }
  }
}
