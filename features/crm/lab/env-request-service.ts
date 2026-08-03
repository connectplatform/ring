import 'server-only'

import { MessageService } from '@/features/chat/services/message-service'
import { ConversationService } from '@/features/chat/services/conversation-service'
import type { EnvRequestMetadata } from '@/features/chat/types'
import { createNotification } from '@/features/notifications/services/notification-service'
import {
  NotificationType,
  NotificationChannel,
  NotificationPriority,
} from '@/features/notifications/types'
import { ProjectOrderService } from '@/features/crm/orders/project-order-service'
import { RING_REGGIE_AGENT_ID } from '@/features/crm/lab/reggie-constants'
import { logger } from '@/lib/logger'

const messageService = new MessageService()
const conversationService = new ConversationService()

export async function sendEnvRequest(opts: {
  orderId: string
  conversationId: string
  requesterUserId: string
  requesterName: string
  keys: string[]
  docsPath?: string
}): Promise<{ messageId: string }> {
  const keys = [...new Set(opts.keys.filter(Boolean))]
  if (!keys.length) throw new Error('At least one env key is required')

  const meta: EnvRequestMetadata = {
    kind: 'env_request',
    keys,
    docsPath: opts.docsPath || '/docs/backend/firebase',
    status: 'pending',
    requesterUserId: opts.requesterUserId,
    orderId: opts.orderId,
  }

  const content = `Key update requested: ${keys.join(', ')}`
  const message = await messageService.sendMessage(
    {
      conversationId: opts.conversationId,
      content,
      type: 'env_request',
      metadata: meta as unknown as Record<string, unknown>,
    },
    opts.requesterUserId,
    opts.requesterName,
  )

  // Additive notify with My Orders CTA (MessageService also notifies with /messages?c=)
  try {
    const order = await ProjectOrderService.getById(opts.orderId)
    if (order?.userId) {
      await createNotification({
        userId: order.userId,
        type: NotificationType.ENV_REQUEST,
        priority: NotificationPriority.HIGH,
        title: 'Update project keys',
        body: `Your integrator asked you to set: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '…' : ''}`,
        actionText: 'Update keys',
        actionUrl: `/my-orders/${encodeURIComponent(opts.orderId)}#secrets`,
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        data: {
          orderId: opts.orderId,
          conversationId: opts.conversationId,
          messageId: message.id,
          kind: 'env_request',
          keys,
        },
      } as never)
    }
  } catch (error) {
    logger.warn('env_request buyer notify failed', { orderId: opts.orderId, error })
  }

  return { messageId: message.id }
}

export async function cancelEnvRequest(opts: {
  messageId: string
  actorUserId: string
}): Promise<void> {
  const msg = await messageService.getMessage(opts.messageId)
  if (!msg) throw new Error('Message not found')
  const meta = msg.metadata as unknown as EnvRequestMetadata | undefined
  if (!meta || meta.kind !== 'env_request') throw new Error('Not an env_request')
  if (meta.requesterUserId !== opts.actorUserId) throw new Error('Only requester can cancel')
  if (meta.status !== 'pending') return

  await messageService.updateMessage(opts.messageId, {
    metadata: {
      ...meta,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
    } as unknown as Record<string, unknown>,
  })
}

/** Mark pending env_request messages fulfilled when overlapping keys were saved. */
export async function fulfillEnvRequestsForOrder(
  orderId: string,
  writtenKeys: string[],
): Promise<number> {
  const written = new Set(writtenKeys)
  if (!written.size) return 0

  const conversation = await conversationService.findOrderLabConversation(orderId)
  if (!conversation) return 0

  const page = await messageService.getMessages(conversation.id, RING_REGGIE_AGENT_ID, {
    limit: 80,
  })
  let fulfilled = 0
  for (const msg of page || []) {
    if (msg.type !== 'env_request' && msg.metadata?.kind !== 'env_request') continue
    const meta = msg.metadata as unknown as EnvRequestMetadata
    if (!meta || meta.status !== 'pending') continue
    if (meta.orderId && meta.orderId !== orderId) continue
    const overlap = (meta.keys || []).some((k) => written.has(k))
    if (!overlap) continue
    await messageService.updateMessage(msg.id, {
      metadata: {
        ...meta,
        status: 'fulfilled',
        fulfilledAt: new Date().toISOString(),
      } as unknown as Record<string, unknown>,
    })
    fulfilled += 1
  }
  return fulfilled
}
