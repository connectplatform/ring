import 'server-only'

import { ConversationService } from '@/features/chat/services/conversation-service'
import { MessageService } from '@/features/chat/services/message-service'
import { getSerializedEntityById } from '@/features/entities/services/get-entity-by-id'
import { getEntityTeamUserIds } from '@/features/entities/lib/entity-roles'
import { createNotification } from '@/features/notifications/services/notification-service'
import { NotificationPriority, NotificationType } from '@/features/notifications/types'

/**
 * Opens a rooftop thread for an entity-visibility lead.
 * Uses conversation type `opportunity` so it does not reuse the product-agent chat.
 */
export async function openEntityLeadConversation(input: {
  opportunityId: string
  rooftopId: string
  buyerId: string
  buyerName?: string
  title: string
  note?: string
  productId?: string
  kind?: string
}): Promise<{ conversationId: string } | null> {
  const rooftop = await getSerializedEntityById(input.rooftopId)
  if (!rooftop) return null
  const team = getEntityTeamUserIds(rooftop)
  const participantIds = [...new Set([input.buyerId, ...team])]
  const conversations = new ConversationService()
  const conversation = await conversations.createConversation({
    type: 'opportunity',
    participantIds,
    creatorUserId: input.buyerId,
    metadata: {
      opportunityId: input.opportunityId,
      opportunityName: input.title,
      entityId: input.rooftopId,
      entityName: rooftop.name,
      productId: input.productId,
      subject: input.title,
      kind: input.kind,
    },
  })
  const messages = new MessageService()
  await messages.sendMessage(
    {
      conversationId: conversation.id,
      content: input.note || input.title,
      type: 'text',
    },
    input.buyerId,
    input.buyerName || 'Shopper',
  )
  for (const userId of team) {
    if (userId === input.buyerId) continue
    await createNotification({
      userId,
      type: NotificationType.OPPORTUNITY_CREATED,
      priority: NotificationPriority.HIGH,
      title: input.title,
      body: input.note || input.title,
      actionText: 'Open lead',
      actionUrl: `/opportunities/${input.opportunityId}`,
      data: {
        entityId: input.rooftopId,
        metadata: { opportunityId: input.opportunityId, productId: input.productId },
      },
    }).catch(() => undefined)
  }
  return { conversationId: conversation.id }
}
