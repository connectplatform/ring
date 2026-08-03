'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { logger } from '@/lib/logger'
import type { Message, PollMetadata } from '@/features/chat/types'
import { randomUUID } from 'crypto'

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

function optionId(): string {
  return randomUUID().slice(0, 8)
}

export async function createPollMessage(input: {
  conversationId: string
  question: string
  options: string[]
  allowMultiple?: boolean
  closeAt?: string
}): Promise<ChatInteractiveActionResult> {
  try {
    const { session, error } = await requireSession()
    if (!session) return { success: false, error: error ?? 'Authentication required' }

    const conversationId = String(input.conversationId || '').trim()
    const question = String(input.question || '').trim()
    const labels = (input.options || []).map((o) => String(o || '').trim()).filter(Boolean)

    if (!conversationId) return { success: false, error: 'Conversation is required' }
    if (!question) return { success: false, error: 'Question is required' }
    if (labels.length < 2) return { success: false, error: 'At least two options are required' }
    if (labels.length > 12) return { success: false, error: 'Maximum 12 options' }

    const closeAt = input.closeAt?.trim() || undefined
    if (closeAt) {
      const closeMs = new Date(closeAt).getTime()
      if (!Number.isFinite(closeMs)) {
        return { success: false, error: 'Invalid close time' }
      }
      if (closeMs <= Date.now()) {
        return { success: false, error: 'Close time must be in the future' }
      }
    }

    const { ConversationService } = await import('@/features/chat/services/conversation-service')
    const { MessageService } = await import('@/features/chat/services/message-service')
    const conversations = new ConversationService()
    const messages = new MessageService()

    const conversation = await conversations.getConversationById(conversationId, session.user.id)
    if (!conversation) return { success: false, error: 'Conversation not found' }

    const metadata: PollMetadata = {
      kind: 'poll',
      question,
      options: labels.map((label) => ({ id: optionId(), label })),
      allowMultiple: Boolean(input.allowMultiple),
      closeAt,
      status: 'open',
      votes: {},
      createdByUserId: session.user.id,
    }

    const message = await messages.sendMessage(
      {
        conversationId,
        content: `Poll: ${question}`,
        type: 'poll',
        metadata: metadata as unknown as Record<string, unknown>,
      },
      session.user.id,
      session.user.name || session.user.email || 'User',
      session.user.image || undefined,
    )

    revalidateConversation(conversationId)
    return { success: true, message: 'Poll created', messageId: message.id, data: message }
  } catch (error) {
    logger.error('createPollMessage failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create poll',
    }
  }
}

export async function castPollVote(input: {
  messageId: string
  optionIds: string[]
}): Promise<ChatInteractiveActionResult> {
  try {
    const { session, error } = await requireSession()
    if (!session) return { success: false, error: error ?? 'Authentication required' }

    const messageId = String(input.messageId || '').trim()
    const optionIds = Array.isArray(input.optionIds)
      ? input.optionIds.map((id) => String(id).trim()).filter(Boolean)
      : []

    if (!messageId) return { success: false, error: 'Message is required' }

    const { loadMessageForParticipant } = await import(
      '@/features/chat/lib/load-message-for-participant'
    )
    const { MessageService } = await import('@/features/chat/services/message-service')

    const access = await loadMessageForParticipant(messageId, session.user.id)
    if ('error' in access) return { success: false, error: access.error }

    const messages = new MessageService()
    const optionIdsCopy = optionIds
    const userId = session.user.id

    const updated = await messages.updateMessageLocked(messageId, (msg) => {
      const meta = msg.metadata as unknown as PollMetadata | undefined
      if (msg.type !== 'poll' && meta?.kind !== 'poll') {
        throw new Error('Not a poll message')
      }
      if (!meta || meta.kind !== 'poll') {
        throw new Error('Invalid poll metadata')
      }
      if (meta.status !== 'open') {
        throw new Error('Poll is closed')
      }
      if (meta.closeAt && new Date(meta.closeAt).getTime() < Date.now()) {
        throw new Error('Poll has ended')
      }

      const validIds = new Set(meta.options.map((o) => o.id))
      for (const id of optionIdsCopy) {
        if (!validIds.has(id)) throw new Error('Invalid option')
      }
      if (!meta.allowMultiple && optionIdsCopy.length > 1) {
        throw new Error('Single choice only')
      }

      const nextVotes = { ...meta.votes }
      if (optionIdsCopy.length === 0) {
        delete nextVotes[userId]
      } else {
        nextVotes[userId] = meta.allowMultiple ? optionIdsCopy : [optionIdsCopy[0]]
      }

      const nextMeta: PollMetadata = { ...meta, votes: nextVotes }
      return { metadata: nextMeta as unknown as Record<string, unknown> }
    })

    revalidateConversation(access.conversationId)
    return { success: true, message: 'Vote recorded', messageId, data: updated }
  } catch (error) {
    logger.error('castPollVote failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to vote',
    }
  }
}

export async function closePoll(input: {
  messageId: string
}): Promise<ChatInteractiveActionResult> {
  try {
    const { session, error } = await requireSession()
    if (!session) return { success: false, error: error ?? 'Authentication required' }

    const messageId = String(input.messageId || '').trim()
    if (!messageId) return { success: false, error: 'Message is required' }

    const { loadMessageForParticipant } = await import(
      '@/features/chat/lib/load-message-for-participant'
    )
    const { MessageService } = await import('@/features/chat/services/message-service')
    const { createNotification } = await import(
      '@/features/notifications/services/notification-service'
    )
    const { NotificationChannel } = await import('@/features/notifications/types')
    const { buildInteractiveStatusNotify } = await import(
      '@/features/chat/lib/interactive-notify'
    )
    const { ConversationService } = await import('@/features/chat/services/conversation-service')

    const access = await loadMessageForParticipant(messageId, session.user.id)
    if ('error' in access) return { success: false, error: access.error }
    const msg = access.message

    const messages = new MessageService()
    const meta = msg.metadata as unknown as PollMetadata | undefined
    if (!meta || meta.kind !== 'poll') return { success: false, error: 'Not a poll' }
    if (meta.createdByUserId !== session.user.id) {
      return { success: false, error: 'Only the creator can close this poll' }
    }
    if (meta.status !== 'open') {
      return { success: true, message: 'Already closed', messageId, data: msg }
    }

    const nextMeta: PollMetadata = { ...meta, status: 'closed' }
    const updated = await messages.updateMessage(messageId, {
      metadata: nextMeta as unknown as Record<string, unknown>,
    })

    const conversations = new ConversationService()
    const conversation = await conversations.getConversationById(
      msg.conversationId,
      session.user.id,
    )
    if (conversation) {
      const recipients = conversation.participants
        .map((p) => p.userId)
        .filter((id) => id !== session.user.id)
      await Promise.allSettled(
        recipients.map((userId) => {
          const payload = buildInteractiveStatusNotify({
            kind: 'poll',
            userId,
            conversationId: msg.conversationId,
            messageId,
            title: 'Poll closed',
            body: meta.question,
            metadata: nextMeta as unknown as Record<string, unknown>,
          })
          return createNotification({
            ...payload,
            channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
          } as never)
        }),
      )
    }

    revalidateConversation(msg.conversationId)
    return { success: true, message: 'Poll closed', messageId, data: updated }
  } catch (error) {
    logger.error('closePoll failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to close poll',
    }
  }
}
