'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { logger } from '@/lib/logger'
import type { Message, ShareCardMetadata } from '@/features/chat/types'
import { defaultLocale, type Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'

export interface ShareCardActionResult {
  success: boolean
  error?: string
  message?: string
  conversationIds?: string[]
  messageIds?: string[]
}

async function requireSession() {
  const session = await auth()
  if (!session?.user?.id) {
    return { session: null, error: 'Authentication required' as const }
  }
  return { session, error: null }
}

function buildShareUrl(input: {
  targetType: ShareCardMetadata['targetType']
  targetId: string
  url?: string
  locale?: Locale
}): string {
  if (input.url?.trim()) return input.url.trim()
  const locale = input.locale ?? defaultLocale
  switch (input.targetType) {
    case 'future_feature':
    case 'dao_pool':
      return ROUTES.DAO_POOL(input.targetId, locale)
    case 'entity':
      return ROUTES.ENTITY(input.targetId, locale)
    case 'opportunity':
      return ROUTES.OPPORTUNITY(input.targetId, locale)
    case 'product':
      return ROUTES.STORE_PRODUCT(input.targetId, locale)
    default:
      return ROUTES.DAO(locale)
  }
}

export async function shareToContacts(input: {
  targetType: ShareCardMetadata['targetType']
  targetId: string
  title: string
  description?: string
  url?: string
  previewImage?: string
  contactUserIds: string[]
  locale?: Locale
}): Promise<ShareCardActionResult> {
  try {
    const { session, error } = await requireSession()
    if (!session) return { success: false, error: error ?? 'Authentication required' }

    const targetId = String(input.targetId || '').trim()
    const title = String(input.title || '').trim()
    const contactUserIds = Array.from(
      new Set(
        (input.contactUserIds || [])
          .map((id) => String(id || '').trim())
          .filter((id) => id && id !== session.user.id),
      ),
    )

    if (!targetId) return { success: false, error: 'Target is required' }
    if (!title) return { success: false, error: 'Title is required' }
    if (contactUserIds.length === 0) {
      return { success: false, error: 'Select at least one contact' }
    }
    if (contactUserIds.length > 25) {
      return { success: false, error: 'Maximum 25 contacts per share' }
    }

    const { ConversationService } = await import('@/features/chat/services/conversation-service')
    const { MessageService } = await import('@/features/chat/services/message-service')
    const conversations = new ConversationService()
    const messages = new MessageService()

    const url = buildShareUrl({
      targetType: input.targetType,
      targetId,
      url: input.url,
      locale: input.locale,
    })

    const metadata: ShareCardMetadata = {
      kind: 'share_card',
      targetType: input.targetType,
      targetId,
      title,
      description: input.description?.trim() || undefined,
      url,
      previewImage: input.previewImage?.trim() || undefined,
    }

    const content = `Shared: ${title}`
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
          type: 'share_card',
          metadata: metadata as unknown as Record<string, unknown>,
        },
        session.user.id,
        session.user.name || session.user.email || 'User',
        session.user.image || undefined,
      )

      conversationIds.push(conversation.id)
      messageIds.push(message.id)
    }

    revalidatePath('/[locale]/messages')
    return {
      success: true,
      message: `Shared with ${messageIds.length} contact${messageIds.length === 1 ? '' : 's'}`,
      conversationIds,
      messageIds,
    }
  } catch (error) {
    logger.error('shareToContacts failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to share',
    }
  }
}

/** Used by tests / callers that already have a Message. */
export type { Message }
