import 'server-only'

/**
 * CRM support request ↔ in-app support chat bridge.
 * Known Ring users get a `support` conversation seeded with the contact inquiry;
 * when the *client* later replies in that chat, preferChat flips (email paused).
 * Staff replies never flip preferChat — email stays available for email-only leads.
 */

import { ConversationService } from '@/features/chat/services/conversation-service'
import { MessageService } from '@/features/chat/services/message-service'
import type { Conversation } from '@/features/chat/types'
import { EmailThreadService } from '@/features/email-crm/services/email-thread-service'
import { resolveSupportDeskUserIds } from '@/features/email-crm/lib/support-desk'
import { logger } from '@/lib/logger'

const conversationService = new ConversationService()
const messageService = new MessageService()

export type EnsureSupportChatParams = {
  /** Same id as email-crm threadId (e.g. contact-form:contactId) */
  supportRequestId: string
  userId: string
  userName?: string | null
  message: string
  emailContactId?: string
  contactEmail?: string
  subject?: string
  /** Optional single staff/admin (legacy) */
  staffUserId?: string | null
  /** Support desk user ids to join as admin */
  staffUserIds?: string[]
  /** CRM task id for notification deep-link */
  taskId?: string
}

async function notifySupportDesk(params: {
  staffUserIds: string[]
  supportRequestId: string
  conversationId: string
  subject: string
  taskId?: string
}): Promise<void> {
  if (params.staffUserIds.length === 0) return
  try {
    const { createNotification } = await import(
      '@/features/notifications/services/notification-service'
    )
    const {
      NotificationType,
      NotificationChannel,
      NotificationPriority,
    } = await import('@/features/notifications/types')

    await createNotification({
      userIds: params.staffUserIds,
      type: NotificationType.MESSAGE_RECEIVED,
      priority: NotificationPriority.HIGH,
      title: 'New support request',
      body: params.subject || 'A member opened a support request',
      actionText: 'Open CRM tasks',
      actionUrl: params.taskId
        ? `/admin/crm/tasks?taskId=${encodeURIComponent(params.taskId)}`
        : '/admin/crm/tasks',
      channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      data: {
        actionUrl: params.taskId
          ? `/admin/crm/tasks?taskId=${encodeURIComponent(params.taskId)}`
          : '/admin/crm/tasks',
        metadata: {
          supportRequestId: params.supportRequestId,
          conversationId: params.conversationId,
          taskId: params.taskId,
        },
      },
    })
  } catch (error) {
    logger.warn('[SupportChat] Desk notify failed', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Get or create a support-type chat for a known Ring user, seeded with the inquiry.
 */
export async function ensureSupportChatForRequest(
  params: EnsureSupportChatParams,
): Promise<Conversation | null> {
  const {
    supportRequestId,
    userId,
    userName,
    message,
    emailContactId,
    contactEmail,
    subject,
    staffUserId,
    taskId,
  } = params

  if (!supportRequestId || !userId) return null

  const deskIds = [
    ...new Set([
      ...(params.staffUserIds || []),
      ...(staffUserId ? [staffUserId] : []),
      ...resolveSupportDeskUserIds(),
    ].filter((id) => id && id !== userId)),
  ]

  try {
    const existing = await conversationService.findSupportConversation(supportRequestId)
    if (existing) {
      for (const staffId of deskIds) {
        try {
          await conversationService.addParticipant(existing.id, staffId, 'admin')
        } catch {
          // already participant
        }
      }

      // Resubmit / follow-up inquiry — append into existing support room
      if (message.trim()) {
        try {
          await messageService.sendMessage(
            {
              conversationId: existing.id,
              content: message,
              type: 'text',
              metadata: {
                kind: 'support_inquiry',
                supportRequestId,
                source: 'contact-form',
              },
            },
            userId,
            userName || 'Member',
          )
        } catch (error) {
          logger.warn('[SupportChat] Follow-up inquiry seed failed', {
            supportRequestId,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      const thread = await EmailThreadService.getThread(supportRequestId)
      await EmailThreadService.upsertThread(supportRequestId, {
        subject: subject || thread?.subject || existing.metadata?.subject || 'Support request',
        fromEmail: contactEmail || thread?.fromEmail || 'unknown@local',
        supportConversationId: existing.id,
        preferChat: existing.metadata?.preferChat === true,
        contactId: emailContactId ?? thread?.contactId,
        lastMessageAt: new Date().toISOString(),
      })

      if (message.trim()) {
        await notifySupportDesk({
          staffUserIds: deskIds,
          supportRequestId,
          conversationId: existing.id,
          subject: `Follow-up: ${subject || thread?.subject || 'Support request'}`,
          taskId,
        })
      }

      return existing
    }

    const creatorId = deskIds[0] || userId
    const participantIds = [...new Set([userId, ...deskIds])]

    const conversation = await conversationService.createConversation({
      type: 'support',
      participantIds,
      creatorUserId: creatorId,
      metadata: {
        supportRequestId,
        emailContactId,
        requesterUserId: userId,
        subject: subject || 'Support request',
        preferChat: false,
        kind: 'support',
      },
    })

    // Ensure desk roles are admin even when creator was requester
    for (const staffId of deskIds) {
      try {
        await conversationService.addParticipant(conversation.id, staffId, 'admin')
      } catch {
        // already participant
      }
    }

    try {
      await messageService.sendMessage(
        {
          conversationId: conversation.id,
          content: message,
          type: 'text',
          metadata: {
            kind: 'support_inquiry',
            supportRequestId,
            source: 'contact-form',
          },
        },
        userId,
        userName || 'Member',
      )
    } catch (error) {
      logger.warn('[SupportChat] Seed message failed', {
        supportRequestId,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    if (deskIds.length > 0) {
      try {
        await messageService.sendMessage(
          {
            conversationId: conversation.id,
            content: 'Support desk joined this room.',
            type: 'system',
            metadata: { kind: 'support_desk_joined' },
          },
          creatorId,
          'System',
        )
      } catch {
        // non-fatal
      }
    }

    try {
      await EmailThreadService.upsertThread(supportRequestId, {
        subject: subject || 'Support request',
        fromEmail: contactEmail || 'unknown@local',
        supportConversationId: conversation.id,
        preferChat: false,
        contactId: emailContactId ?? null,
        lastMessageAt: new Date().toISOString(),
      })
    } catch (error) {
      logger.warn('[SupportChat] Thread link failed', {
        supportRequestId,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    await notifySupportDesk({
      staffUserIds: deskIds,
      supportRequestId,
      conversationId: conversation.id,
      subject: subject || 'Support request',
      taskId,
    })

    return conversation
  } catch (error) {
    logger.error('[SupportChat] ensureSupportChatForRequest failed', {
      supportRequestId,
      userId,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * Client replied in the in-app support chat — prefer chat over email going forward.
 * Staff replies must NOT flip this (anonymous / email-only leads keep email as delivery).
 * Seed inquiry messages (kind: support_inquiry) are ignored.
 */
export async function markSupportPreferChat(params: {
  conversationId: string
  actorUserId: string
  /** Skip auto seed from contact-form / ensureSupportChatForRequest */
  messageKind?: string | null
}): Promise<void> {
  try {
    if (params.messageKind === 'support_inquiry') return
    if (params.messageKind === 'email_mirror') return

    const conversation = await conversationService.getConversationById(
      params.conversationId,
      params.actorUserId,
    )
    if (!conversation || conversation.type !== 'support') return
    if (conversation.metadata?.preferChat === true) return

    const supportRequestId = conversation.metadata?.supportRequestId
    if (!supportRequestId) return

    const requesterId =
      conversation.metadata?.requesterUserId ||
      conversation.participants.find((p) => p.role === 'member')?.userId ||
      conversation.participants[0]?.userId

    if (!requesterId || params.actorUserId !== requesterId) {
      return
    }

    await conversationService.updateConversation(conversation.id, params.actorUserId, {
      metadata: {
        ...conversation.metadata,
        preferChat: true,
      },
    })

    const thread = await EmailThreadService.getThread(supportRequestId)
    await EmailThreadService.upsertThread(supportRequestId, {
      subject: thread?.subject || conversation.metadata?.subject || 'Support request',
      fromEmail: thread?.fromEmail || 'unknown@local',
      preferChat: true,
      supportConversationId: conversation.id,
      status: 'ongoing',
      messageCount: 0,
      lastMessageAt: new Date().toISOString(),
    })

    logger.info('[SupportChat] preferChat enabled — client chose in-app chat', {
      supportRequestId,
      conversationId: conversation.id,
      actorUserId: params.actorUserId,
    })
  } catch (error) {
    logger.warn('[SupportChat] markSupportPreferChat failed', {
      conversationId: params.conversationId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
